import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AuditAction,
  ConsentType,
  Role,
  WasteLogStatus,
} from '../generated/prisma/client.js';
import { ProgressionService } from '../lessons/progression.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_RESUBMISSIONS = 3;
const DEFAULT_XP_PER_LOG = 20;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'waste-logs');

function parseStatus(raw?: string): WasteLogStatus | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (
    upper === WasteLogStatus.PENDING ||
    upper === WasteLogStatus.APPROVED ||
    upper === WasteLogStatus.REJECTED
  ) {
    return upper;
  }
  throw new BadRequestException(
    'status must be pending, approved, or rejected.',
  );
}

@Injectable()
export class WasteLogsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progression: ProgressionService,
  ) {}

  private async savePhoto(file?: UploadedPhoto): Promise<string> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('A photo is required.');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Photo must be 5 MB or smaller.');
    }
    let ext: string;
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      ext = 'jpg';
    } else if (file.mimetype === 'image/png') {
      ext = 'png';
    } else {
      throw new BadRequestException('Photo must be a JPEG or PNG image.');
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return `/uploads/waste-logs/${filename}`;
  }

  private async getXpPerLog(): Promise<number> {
    const cfg = await this.prisma.appConfig.findUnique({
      where: { key: 'ecoscan_xp_per_log' },
    });
    return typeof cfg?.value === 'number' && cfg.value >= 0
      ? cfg.value
      : DEFAULT_XP_PER_LOG;
  }

  async submit(userId: string, rawBagCount: unknown, photo?: UploadedPhoto) {
    const bagCount = Number(rawBagCount);
    if (!Number.isInteger(bagCount) || bagCount <= 0) {
      throw new UnprocessableEntityException({
        code: 'INVALID_BAG_COUNT',
        message: 'bagCount must be a positive integer.',
      });
    }

    const [user, consent] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.consentRecord.findFirst({
        where: {
          userId,
          consentType: ConsentType.MEDIA_CAPTURE,
          revokedAt: null,
        },
      }),
    ]);

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException();
    }
    if (!user.cohortId) {
      throw new BadRequestException({
        code: 'NO_COHORT',
        message: 'Join a school cohort before submitting waste logs.',
      });
    }
    if (!consent) {
      throw new ForbiddenException({
        code: 'CONSENT_REQUIRED',
        message:
          'Parental/guardian media consent is required before submitting photos.',
      });
    }

    const photoRef = await this.savePhoto(photo);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.wasteLogEntry.create({
        data: {
          userId,
          cohortId: user.cohortId!,
          bagCount,
          photoRef,
          status: WasteLogStatus.PENDING,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'WasteLogEntry',
          entityId: entry.id,
          action: AuditAction.CREATE,
          actorId: userId,
          newData: { bagCount, status: WasteLogStatus.PENDING },
        },
      });

      return entry;
    });
  }

  async listMine(userId: string, rawStatus?: string) {
    const status = parseStatus(rawStatus);
    return this.prisma.wasteLogEntry.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resubmit(
    userId: string,
    entryId: string,
    rawBagCount?: unknown,
    photo?: UploadedPhoto,
  ) {
    const entry = await this.prisma.wasteLogEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Waste log entry not found.');
    }
    if (entry.status !== WasteLogStatus.REJECTED) {
      throw new ConflictException({
        code: 'NOT_REJECTED',
        message: 'Only rejected entries can be resubmitted.',
      });
    }
    if (entry.resubmissionCount >= MAX_RESUBMISSIONS) {
      throw new BadRequestException({
        code: 'MAX_RESUBMISSIONS_REACHED',
        message: 'This entry has reached the maximum resubmission limit.',
      });
    }

    let bagCount = entry.bagCount;
    if (rawBagCount !== undefined && rawBagCount !== '') {
      const parsed = Number(rawBagCount);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new UnprocessableEntityException({
          code: 'INVALID_BAG_COUNT',
          message: 'bagCount must be a positive integer.',
        });
      }
      bagCount = parsed;
    }

    const photoRef = photo ? await this.savePhoto(photo) : entry.photoRef;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wasteLogEntry.update({
        where: { id: entryId },
        data: {
          bagCount,
          photoRef,
          status: WasteLogStatus.PENDING,
          reviewNote: null,
          reviewedById: null,
          reviewedAt: null,
          resubmissionCount: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'WasteLogEntry',
          entityId: entryId,
          action: AuditAction.STATUS_CHANGE,
          actorId: userId,
          previousData: {
            bagCount: entry.bagCount,
            status: entry.status,
          },
          newData: {
            bagCount,
            status: WasteLogStatus.PENDING,
          },
        },
      });

      return updated;
    });
  }

  async listQueue(
    facilitatorId: string,
    role: string,
    rawStatus?: string,
    cohortId?: string,
  ) {
    const status = parseStatus(rawStatus) ?? WasteLogStatus.PENDING;

    if (role === Role.PROGRAM_ADMIN) {
      return this.prisma.wasteLogEntry.findMany({
        where: { status, ...(cohortId ? { cohortId } : {}) },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
    }

    const assignments = await this.prisma.cohortFacilitator.findMany({
      where: { userId: facilitatorId },
      select: { cohortId: true },
    });
    const assignedIds = assignments.map((a) => a.cohortId);

    if (cohortId && !assignedIds.includes(cohortId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You are not assigned to this cohort.',
      });
    }

    const targetCohortIds = cohortId ? [cohortId] : assignedIds;
    if (targetCohortIds.length === 0) {
      return [];
    }

    return this.prisma.wasteLogEntry.findMany({
      where: { status, cohortId: { in: targetCohortIds } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async review(
    reviewerId: string,
    role: string,
    entryId: string,
    decisionRaw: unknown,
    noteRaw?: unknown,
  ) {
    const decision =
      typeof decisionRaw === 'string' ? decisionRaw.trim().toUpperCase() : '';
    if (
      decision !== WasteLogStatus.APPROVED &&
      decision !== WasteLogStatus.REJECTED
    ) {
      throw new BadRequestException(
        'decision must be "approved" or "rejected".',
      );
    }

    const entry = await this.prisma.wasteLogEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundException('Waste log entry not found.');
    }

    if (role !== Role.PROGRAM_ADMIN) {
      const assigned = await this.prisma.cohortFacilitator.findUnique({
        where: {
          cohortId_userId: { cohortId: entry.cohortId, userId: reviewerId },
        },
      });
      if (!assigned) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You are not assigned to this cohort.',
        });
      }
    }

    if (entry.status !== WasteLogStatus.PENDING) {
      throw new ConflictException({
        code: 'WASTE_LOG_ALREADY_REVIEWED',
        message: 'This entry has already been reviewed.',
      });
    }

    const reviewNote =
      typeof noteRaw === 'string' && noteRaw.trim().length > 0
        ? noteRaw.trim()
        : null;
    const xpPerLog = await this.getXpPerLog();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wasteLogEntry.update({
        where: { id: entryId },
        data: {
          status: decision,
          reviewNote,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'WasteLogEntry',
          entityId: entryId,
          action: AuditAction.STATUS_CHANGE,
          actorId: reviewerId,
          previousData: { status: entry.status },
          newData: { status: decision, reviewNote },
        },
      });

      if (decision === WasteLogStatus.APPROVED && xpPerLog > 0) {
        await this.progression.awardPoints(tx, entry.userId, xpPerLog, {
          countForStreak: false,
        });
      }

      return updated;
    });
  }

  async getCohortTotals(userId: string, role: string, cohortId: string) {
    if (role === Role.STUDENT) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cohortId: true },
      });
      if (user?.cohortId !== cohortId) {
        throw new ForbiddenException();
      }
    } else if (role === Role.FACILITATOR) {
      const assigned = await this.prisma.cohortFacilitator.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
      });
      if (!assigned) {
        throw new ForbiddenException();
      }
    }

    const [agg, rateCfg] = await Promise.all([
      this.prisma.wasteLogEntry.aggregate({
        where: { cohortId, status: WasteLogStatus.APPROVED },
        _sum: { bagCount: true },
        _count: { id: true },
      }),
      this.prisma.appConfig.findUnique({
        where: { key: 'ecoscan_conversion_rate' },
      }),
    ]);

    const rate =
      rateCfg?.value && typeof rateCfg.value === 'object'
        ? (rateCfg.value as { sachetsPerBag?: number; sachetsPerPiece?: number })
        : {};
    const sachetsPerBag =
      typeof rate.sachetsPerBag === 'number' && rate.sachetsPerBag > 0
        ? rate.sachetsPerBag
        : 50;
    const sachetsPerPiece =
      typeof rate.sachetsPerPiece === 'number' && rate.sachetsPerPiece > 0
        ? rate.sachetsPerPiece
        : 500;

    const totalBags = agg._sum.bagCount ?? 0;
    const estimatedSachets = totalBags * sachetsPerBag;
    const estimatedPieces = Math.floor(estimatedSachets / sachetsPerPiece);

    return {
      cohortId,
      approvedEntries: agg._count.id,
      totalBags,
      estimatedSachets,
      estimatedPieces,
    };
  }
}
