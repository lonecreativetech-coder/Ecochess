import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TokensService } from '../auth/tokens.service.js';
import {
  AuditAction,
  LessonTrack,
  Role,
  WasteLogStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LADDER } from '../users/ladder.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  // --- Schools & Cohorts ---

  async createSchool(input: {
    name?: unknown;
    location?: unknown;
    lga?: unknown;
    state?: unknown;
  }) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new BadRequestException('School name is required.');

    return this.prisma.school.create({
      data: {
        name,
        location:
          typeof input.location === 'string' ? input.location.trim() : null,
        lga: typeof input.lga === 'string' ? input.lga.trim() : null,
        state: typeof input.state === 'string' ? input.state.trim() : null,
      },
    });
  }

  async listSchools(state?: string, lga?: string) {
    return this.prisma.school.findMany({
      where: {
        ...(state ? { state: state.trim() } : {}),
        ...(lga ? { lga: lga.trim() } : {}),
      },
      include: { _count: { select: { cohorts: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateSchool(
    id: string,
    input: {
      name?: unknown;
      location?: unknown;
      lga?: unknown;
      state?: unknown;
      isActive?: unknown;
    },
  ) {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('School not found.');

    const data: Record<string, unknown> = {};
    if (typeof input.name === 'string' && input.name.trim()) {
      data.name = input.name.trim();
    }
    if (typeof input.location === 'string') {
      data.location = input.location.trim();
    }
    if (typeof input.lga === 'string') data.lga = input.lga.trim();
    if (typeof input.state === 'string') data.state = input.state.trim();
    if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

    return this.prisma.school.update({ where: { id }, data });
  }

  async createCohort(
    schoolId: string,
    input: { name?: unknown; academicYear?: unknown; facilitatorIds?: unknown },
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException('School not found.');

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new BadRequestException('Cohort name is required.');

    const facilitatorIds = Array.isArray(input.facilitatorIds)
      ? input.facilitatorIds.filter((f): f is string => typeof f === 'string')
      : [];

    return this.prisma.cohort.create({
      data: {
        name,
        schoolId,
        academicYear:
          typeof input.academicYear === 'string'
            ? input.academicYear.trim()
            : null,
        facilitators:
          facilitatorIds.length > 0
            ? { create: facilitatorIds.map((userId) => ({ userId })) }
            : undefined,
      },
      include: { facilitators: true },
    });
  }

  async listCohorts(schoolId: string) {
    return this.prisma.cohort.findMany({
      where: { schoolId },
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateCohort(
    id: string,
    input: {
      name?: unknown;
      academicYear?: unknown;
      isActive?: unknown;
      facilitatorIds?: unknown;
    },
  ) {
    const existing = await this.prisma.cohort.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cohort not found.');

    const data: Record<string, unknown> = {};
    if (typeof input.name === 'string' && input.name.trim()) {
      data.name = input.name.trim();
    }
    if (typeof input.academicYear === 'string') {
      data.academicYear = input.academicYear.trim();
    }
    if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

    return this.prisma.$transaction(async (tx) => {
      if (Array.isArray(input.facilitatorIds)) {
        const ids = input.facilitatorIds.filter(
          (f): f is string => typeof f === 'string',
        );
        await tx.cohortFacilitator.deleteMany({ where: { cohortId: id } });
        if (ids.length > 0) {
          await tx.cohortFacilitator.createMany({
            data: ids.map((userId) => ({ cohortId: id, userId })),
          });
        }
      }

      return tx.cohort.update({
        where: { id },
        data,
        include: { facilitators: true },
      });
    });
  }

  async deactivateCohort(id: string) {
    const existing = await this.prisma.cohort.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cohort not found.');
    return this.prisma.cohort.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // --- Users ---

  async listUsers(roleRaw?: string, cohortId?: string, status?: string) {
    const role = roleRaw ? (roleRaw.trim().toUpperCase() as Role) : undefined;
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(cohortId ? { cohortId } : {}),
        ...(status === 'deleted'
          ? { deletedAt: { not: null } }
          : status === 'active'
            ? { deletedAt: null }
            : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        cohortId: true,
        lifetimeGreenPoints: true,
        greenPointBalance: true,
        streakCount: true,
        deletedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(
    actorId: string,
    targetId: string,
    input: { role?: unknown; cohortId?: unknown; restore?: unknown },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!existing) throw new NotFoundException('User not found.');

    const data: Record<string, unknown> = {};
    if (typeof input.role === 'string') {
      data.role = input.role.trim().toUpperCase() as Role;
    }
    if (input.cohortId !== undefined) {
      data.cohortId =
        typeof input.cohortId === 'string' ? input.cohortId : null;
    }
    if (input.restore === true) {
      data.deletedAt = null;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data,
      });

      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: targetId,
          action: AuditAction.UPDATE,
          actorId,
          previousData: { role: existing.role, cohortId: existing.cohortId },
          newData: data as Record<string, string | null>,
        },
      });

      return updated;
    });
  }

  async anonymizeUser(actorId: string, targetId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!existing) throw new NotFoundException('User not found.');

    const hashedPhone = `anon:${createHash('sha256').update(existing.phone).digest('hex').slice(0, 24)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: {
          name: null,
          phone: hashedPhone,
          ageBand: null,
          deletedAt: existing.deletedAt ?? new Date(),
        },
      });

      await tx.wasteLogEntry.updateMany({
        where: { userId: targetId },
        data: { photoRef: 'scrubbed' },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: targetId,
          action: AuditAction.DELETE,
          actorId,
          newData: { anonymized: true },
        },
      });
    });

    await this.tokens.revokeAllForUser(targetId);
    return { anonymized: true, userId: targetId };
  }

  // --- Content (Lessons & Puzzles) ---

  async createLesson(input: Record<string, unknown>) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const trackRaw =
      typeof input.track === 'string' ? input.track.trim().toUpperCase() : '';
    const track =
      trackRaw === 'CHESS' || trackRaw === LessonTrack.CHESS_TACTICS
        ? LessonTrack.CHESS_TACTICS
        : trackRaw === 'ECO' || trackRaw === LessonTrack.ECO_LITERACY
          ? LessonTrack.ECO_LITERACY
          : null;
    const order = Number(input.order);

    if (!title || !track || !Number.isInteger(order) || order < 0) {
      throw new BadRequestException(
        'title, track (CHESS_TACTICS|ECO_LITERACY), and order are required.',
      );
    }

    return this.prisma.lesson.create({
      data: {
        title,
        track,
        order,
        xpValue:
          typeof input.xpValue === 'number' && input.xpValue >= 0
            ? input.xpValue
            : 50,
        contentPayload: (input.contentPayload ?? {}) as object,
      },
    });
  }

  async updateLesson(id: string, input: Record<string, unknown>) {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lesson not found.');

    const data: Record<string, unknown> = {};
    if (typeof input.title === 'string' && input.title.trim()) {
      data.title = input.title.trim();
    }
    if (typeof input.order === 'number' && Number.isInteger(input.order)) {
      data.order = input.order;
    }
    if (typeof input.xpValue === 'number' && input.xpValue >= 0) {
      data.xpValue = input.xpValue;
    }
    if (input.contentPayload !== undefined) {
      data.contentPayload = input.contentPayload;
    }
    if (typeof input.isActive === 'boolean') {
      data.isActive = input.isActive;
    }

    return this.prisma.lesson.update({ where: { id }, data });
  }

  async deleteLesson(id: string) {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lesson not found.');
    return this.prisma.lesson.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createPuzzle(input: Record<string, unknown>) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const boardPosition =
      typeof input.boardPosition === 'string' ? input.boardPosition.trim() : '';
    const hintText =
      typeof input.hintText === 'string' ? input.hintText.trim() : '';
    if (!title || !boardPosition || !hintText || !Array.isArray(input.solution)) {
      throw new BadRequestException(
        'title, boardPosition, hintText, and solution[] are required.',
      );
    }

    return this.prisma.puzzle.create({
      data: {
        title,
        difficultyTier:
          typeof input.difficultyTier === 'number' && input.difficultyTier >= 1
            ? input.difficultyTier
            : 1,
        boardPosition,
        solution: input.solution as object,
        hintText,
        xpValue:
          typeof input.xpValue === 'number' && input.xpValue >= 0
            ? input.xpValue
            : 25,
      },
    });
  }

  async updatePuzzle(id: string, input: Record<string, unknown>) {
    const existing = await this.prisma.puzzle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Puzzle not found.');

    const data: Record<string, unknown> = {};
    if (typeof input.title === 'string' && input.title.trim()) {
      data.title = input.title.trim();
    }
    if (typeof input.difficultyTier === 'number') {
      data.difficultyTier = input.difficultyTier;
    }
    if (typeof input.boardPosition === 'string') {
      data.boardPosition = input.boardPosition.trim();
    }
    if (Array.isArray(input.solution)) data.solution = input.solution;
    if (typeof input.hintText === 'string') {
      data.hintText = input.hintText.trim();
    }
    if (typeof input.xpValue === 'number') data.xpValue = input.xpValue;
    if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

    return this.prisma.puzzle.update({ where: { id }, data });
  }

  async deletePuzzle(id: string) {
    const existing = await this.prisma.puzzle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Puzzle not found.');
    return this.prisma.puzzle.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // --- Roster & Reports ---

  async getCohortRoster(userId: string, role: string, cohortId: string) {
    if (role === Role.FACILITATOR) {
      const assigned = await this.prisma.cohortFacilitator.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
      });
      if (!assigned) throw new ForbiddenException();
    }

    return this.prisma.user.findMany({
      where: { cohortId, role: Role.STUDENT, deletedAt: null },
      select: {
        id: true,
        name: true,
        ageBand: true,
        lifetimeGreenPoints: true,
        streakCount: true,
        streakLastDate: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async exportCsvSummary(): Promise<string> {
    const cohorts = await this.prisma.cohort.findMany({
      include: {
        school: { select: { name: true, state: true } },
        users: {
          where: { role: Role.STUDENT, deletedAt: null },
          select: { lifetimeGreenPoints: true },
        },
        wasteLogEntries: {
          where: { status: WasteLogStatus.APPROVED },
          select: { bagCount: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const header =
      'school_name,state,cohort_name,active_students,total_xp,approved_waste_logs,approved_bags';
    const lines = cohorts.map((c) => {
      const totalXp = c.users.reduce((s, u) => s + u.lifetimeGreenPoints, 0);
      const totalBags = c.wasteLogEntries.reduce((s, w) => s + w.bagCount, 0);
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        esc(c.school.name),
        esc(c.school.state ?? ''),
        esc(c.name),
        c.users.length,
        totalXp,
        c.wasteLogEntries.length,
        totalBags,
      ].join(',');
    });

    return [header, ...lines].join('\n');
  }

  // --- Config ---

  async setConfig(key: string, value: unknown) {
    return this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }

  async getLadderThresholds() {
    const cfg = await this.prisma.appConfig.findUnique({
      where: { key: 'ladder_thresholds' },
    });
    return cfg?.value ?? LADDER;
  }

  async systemHealth() {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      dbLatencyMs: Date.now() - start,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
