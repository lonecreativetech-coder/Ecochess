import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OtpService } from '../auth/otp.service.js';
import { normalizePhone } from '../auth/phone.js';
import { TokensService } from '../auth/tokens.service.js';
import {
  ConsentCaptureMethod,
  ConsentType,
  NotificationType,
  StreakFreezeStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankFor, type RankInfo } from './ladder.js';

const VALID_AGE_BANDS = new Set(['UNDER_10', '10_13', '14_17', '18_PLUS']);
const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.STREAK_REMINDER,
  NotificationType.RANK_UP,
  NotificationType.EVENT_ALERT,
  NotificationType.WASTE_LOG_STATUS,
  NotificationType.BADGE_EARNED,
];

export interface UserProfileResponse {
  id: string;
  name: string | null;
  phone: string;
  ageBand: string | null;
  role: string;
  cohortId: string | null;
  lifetimeGreenPoints: number;
  greenPointBalance: number;
  streakCount: number;
  freezesHeld: number;
  rank: RankInfo;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const [user, freezesHeld] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.streakFreeze.count({
        where: {
          userId,
          status: StreakFreezeStatus.AVAILABLE,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException();
    }

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      ageBand: user.ageBand,
      role: user.role,
      cohortId: user.cohortId,
      lifetimeGreenPoints: user.lifetimeGreenPoints,
      greenPointBalance: user.greenPointBalance,
      streakCount: user.streakCount,
      freezesHeld,
      rank: rankFor(user.lifetimeGreenPoints),
    };
  }

  async updateProfile(
    userId: string,
    input: { name?: unknown; ageBand?: unknown },
  ): Promise<UserProfileResponse> {
    const data: { name?: string; ageBand?: string } = {};

    if (input.name !== undefined) {
      if (typeof input.name !== 'string') {
        throw new BadRequestException('Name must be a string.');
      }
      const trimmed = input.name.trim();
      if (trimmed.length === 0 || trimmed.length > 100) {
        throw new BadRequestException(
          'Name must be between 1 and 100 characters.',
        );
      }
      data.name = trimmed;
    }

    if (input.ageBand !== undefined) {
      if (
        typeof input.ageBand !== 'string' ||
        !VALID_AGE_BANDS.has(input.ageBand)
      ) {
        throw new BadRequestException(
          'ageBand must be one of: UNDER_10, 10_13, 14_17, 18_PLUS.',
        );
      }
      data.ageBand = input.ageBand;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getProfile(userId);
  }

  async grantConsent(
    userId: string,
    input: {
      consentType?: unknown;
      guardianName?: unknown;
      guardianPhone?: unknown;
      captureMethod?: unknown;
    },
  ) {
    if (
      input.consentType !== ConsentType.MEDIA_CAPTURE &&
      input.consentType !== ConsentType.DATA_PROCESSING
    ) {
      throw new BadRequestException(
        'consentType must be MEDIA_CAPTURE or DATA_PROCESSING.',
      );
    }

    const guardianName =
      typeof input.guardianName === 'string' ? input.guardianName.trim() : '';
    if (!guardianName || guardianName.length > 100) {
      throw new BadRequestException('A valid guardianName is required.');
    }

    let guardianPhone: string | null = null;
    if (input.guardianPhone !== undefined && input.guardianPhone !== null) {
      guardianPhone = normalizePhone(input.guardianPhone);
      if (!guardianPhone) {
        throw new BadRequestException('Enter a valid guardianPhone.');
      }
    }

    const captureMethod =
      input.captureMethod === ConsentCaptureMethod.SIGNED_FORM_UPLOAD
        ? ConsentCaptureMethod.SIGNED_FORM_UPLOAD
        : ConsentCaptureMethod.IN_APP_CHECKBOX;

    return this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: input.consentType,
        guardianName,
        guardianPhone,
        captureMethod,
      },
    });
  }

  async getConsentStatus(userId: string) {
    const active = await this.prisma.consentRecord.findMany({
      where: { userId, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });

    const mediaCapture = active.find(
      (c) => c.consentType === ConsentType.MEDIA_CAPTURE,
    );
    const dataProcessing = active.find(
      (c) => c.consentType === ConsentType.DATA_PROCESSING,
    );

    return {
      MEDIA_CAPTURE: mediaCapture
        ? { granted: true, grantedAt: mediaCapture.grantedAt, guardianName: mediaCapture.guardianName }
        : { granted: false },
      DATA_PROCESSING: dataProcessing
        ? { granted: true, grantedAt: dataProcessing.grantedAt, guardianName: dataProcessing.guardianName }
        : { granted: false },
    };
  }

  async revokeConsent(userId: string, rawType: string) {
    if (
      rawType !== ConsentType.MEDIA_CAPTURE &&
      rawType !== ConsentType.DATA_PROCESSING
    ) {
      throw new BadRequestException(
        'type must be MEDIA_CAPTURE or DATA_PROCESSING.',
      );
    }

    const updated = await this.prisma.consentRecord.updateMany({
      where: { userId, consentType: rawType, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { revoked: updated.count > 0 };
  }

  async getNotificationPreferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const map = new Map(rows.map((r) => [r.type, r.enabled]));
    return ALL_NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: map.get(type) ?? true,
    }));
  }

  async updateNotificationPreferences(
    userId: string,
    items: unknown,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        'Provide an array of { type, enabled } preferences.',
      );
    }

    const validTypes = new Set<string>(ALL_NOTIFICATION_TYPES);
    const updates: Array<{ type: NotificationType; enabled: boolean }> = [];

    for (const item of items) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).type !== 'string' ||
        !validTypes.has((item as Record<string, unknown>).type as string) ||
        typeof (item as Record<string, unknown>).enabled !== 'boolean'
      ) {
        throw new BadRequestException('Invalid notification preference entry.');
      }
      updates.push({
        type: (item as Record<string, unknown>).type as NotificationType,
        enabled: (item as Record<string, unknown>).enabled as boolean,
      });
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: u.type } },
          create: { userId, type: u.type, enabled: u.enabled },
          update: { enabled: u.enabled },
        }),
      ),
    );

    return this.getNotificationPreferences(userId);
  }

  async requestAccountDeletion(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      throw new NotFoundException();
    }

    await this.otp.verifyCode(user.phone, code);

    const deletedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt },
    });
    await this.tokens.revokeAllForUser(userId);

    return {
      deletedAt,
      gracePeriodDays: 30,
    };
  }
}
