import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  AuditAction,
  JoinCodeType,
  Role,
  WasteLogStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_EXPIRES_DAYS = 30;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateJoinCodeString(): string {
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += LETTERS[randomInt(0, LETTERS.length)];
  }
  const digits = randomInt(0, 10000).toString().padStart(4, '0');
  return `${prefix}-${digits}`;
}

@Injectable()
export class FacilitatorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async assertCohortAccess(
    userId: string,
    role: string,
    cohortId: string,
  ): Promise<void> {
    if (role === Role.PROGRAM_ADMIN) return;
    const assigned = await this.prisma.cohortFacilitator.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
    });
    if (!assigned) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You are not assigned to this cohort.',
      });
    }
  }

  async createJoinCode(
    userId: string,
    role: string,
    input: {
      cohortId?: unknown;
      type?: unknown;
      maxUses?: unknown;
      expiresInDays?: unknown;
    },
  ) {
    const cohortId =
      typeof input.cohortId === 'string' ? input.cohortId.trim() : '';
    if (!cohortId) {
      throw new BadRequestException('cohortId is required.');
    }

    await this.assertCohortAccess(userId, role, cohortId);

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
    });
    if (!cohort || !cohort.isActive) {
      throw new NotFoundException('Cohort not found.');
    }

    const type =
      input.type === JoinCodeType.SINGLE_USE || input.type === 'single_use'
        ? JoinCodeType.SINGLE_USE
        : JoinCodeType.MULTI_USE;

    let maxUses: number | null = type === JoinCodeType.SINGLE_USE ? 1 : null;
    if (
      type === JoinCodeType.MULTI_USE &&
      input.maxUses !== undefined &&
      input.maxUses !== null
    ) {
      const parsed = Number(input.maxUses);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('maxUses must be a positive integer.');
      }
      maxUses = parsed;
    }

    const days =
      typeof input.expiresInDays === 'number' && input.expiresInDays > 0
        ? input.expiresInDays
        : DEFAULT_EXPIRES_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const code = generateJoinCodeString();

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.joinCode.create({
        data: {
          code,
          cohortId,
          createdById: userId,
          type,
          maxUses,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'JoinCode',
          entityId: created.id,
          action: AuditAction.CREATE,
          actorId: userId,
          newData: { code, cohortId, type, maxUses },
        },
      });

      return created;
    });
  }

  async listJoinCodes(userId: string, role: string, cohortId?: string) {
    if (cohortId) {
      await this.assertCohortAccess(userId, role, cohortId);
      return this.prisma.joinCode.findMany({
        where: { cohortId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === Role.PROGRAM_ADMIN) {
      return this.prisma.joinCode.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const assigned = await this.prisma.cohortFacilitator.findMany({
      where: { userId },
      select: { cohortId: true },
    });
    const ids = assigned.map((a) => a.cohortId);
    if (ids.length === 0) return [];

    return this.prisma.joinCode.findMany({
      where: { cohortId: { in: ids }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeJoinCode(userId: string, role: string, codeId: string) {
    const existing = await this.prisma.joinCode.findUnique({
      where: { id: codeId },
    });
    if (!existing) {
      throw new NotFoundException('Join code not found.');
    }

    await this.assertCohortAccess(userId, role, existing.cohortId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.joinCode.update({
        where: { id: codeId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'JoinCode',
          entityId: codeId,
          action: AuditAction.DELETE,
          actorId: userId,
          previousData: { isActive: existing.isActive },
          newData: { isActive: false },
        },
      });

      return updated;
    });
  }

  async getCohortProgress(userId: string, role: string, cohortId: string) {
    await this.assertCohortAccess(userId, role, cohortId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      students,
      lessonsCompleted,
      pendingWasteLogs,
      approvedWasteAgg,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { cohortId, role: Role.STUDENT, deletedAt: null },
        select: {
          id: true,
          name: true,
          lifetimeGreenPoints: true,
          streakCount: true,
          streakLastDate: true,
        },
        orderBy: { lifetimeGreenPoints: 'desc' },
      }),
      this.prisma.lessonCompletion.count({
        where: { user: { cohortId, deletedAt: null } },
      }),
      this.prisma.wasteLogEntry.count({
        where: { cohortId, status: WasteLogStatus.PENDING },
      }),
      this.prisma.wasteLogEntry.aggregate({
        where: { cohortId, status: WasteLogStatus.APPROVED },
        _sum: { bagCount: true },
        _count: { id: true },
      }),
    ]);

    const totalStudents = students.length;
    const activeStudents7d = students.filter(
      (s) => s.streakLastDate && s.streakLastDate >= sevenDaysAgo,
    ).length;
    const totalXp = students.reduce(
      (sum, s) => sum + s.lifetimeGreenPoints,
      0,
    );
    const averageXp =
      totalStudents > 0 ? Math.round(totalXp / totalStudents) : 0;
    const averageStreak =
      totalStudents > 0
        ? Number(
            (
              students.reduce((sum, s) => sum + s.streakCount, 0) /
              totalStudents
            ).toFixed(1),
          )
        : 0;

    return {
      cohortId,
      totalStudents,
      activeStudents7d,
      lessonsCompleted,
      averageXp,
      averageStreak,
      pendingWasteLogs,
      approvedWasteLogs: approvedWasteAgg._count.id,
      approvedBags: approvedWasteAgg._sum.bagCount ?? 0,
      topStudents: students.slice(0, 3),
    };
  }
}
