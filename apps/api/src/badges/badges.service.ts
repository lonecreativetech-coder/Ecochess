import { Inject, Injectable } from '@nestjs/common';
import {
  BadgeCriteriaType,
  EventRegistrationStatus,
  WasteLogStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankFor } from '../users/ladder.js';

@Injectable()
export class BadgesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async evaluateForUser(userId: string): Promise<string[]> {
    const [user, badges, existing, lessonCount, wasteCount, eventCount] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.badge.findMany(),
        this.prisma.userBadge.findMany({
          where: { userId },
          select: { badgeId: true },
        }),
        this.prisma.lessonCompletion.count({ where: { userId } }),
        this.prisma.wasteLogEntry.count({
          where: { userId, status: WasteLogStatus.APPROVED },
        }),
        this.prisma.eventRegistration.count({
          where: { userId, status: EventRegistrationStatus.ATTENDED },
        }),
      ]);

    if (!user || badges.length === 0) {
      return [];
    }

    const earnedSet = new Set(existing.map((e) => e.badgeId));
    const currentTier = rankFor(user.lifetimeGreenPoints).tier;
    const newlyEarned: Array<{ userId: string; badgeId: string }> = [];

    for (const badge of badges) {
      if (earnedSet.has(badge.id)) continue;

      let qualified = false;
      switch (badge.criteriaType) {
        case BadgeCriteriaType.LESSON_COUNT:
          qualified = lessonCount >= badge.criteriaValue;
          break;
        case BadgeCriteriaType.WASTE_LOG_COUNT:
          qualified = wasteCount >= badge.criteriaValue;
          break;
        case BadgeCriteriaType.STREAK_DAYS:
          qualified = user.streakCount >= badge.criteriaValue;
          break;
        case BadgeCriteriaType.RANK_REACHED:
          qualified = currentTier >= badge.criteriaValue;
          break;
        case BadgeCriteriaType.EVENT_ATTENDED:
          qualified = eventCount >= badge.criteriaValue;
          break;
      }

      if (qualified) {
        newlyEarned.push({ userId, badgeId: badge.id });
      }
    }

    if (newlyEarned.length > 0) {
      await this.prisma.userBadge.createMany({
        data: newlyEarned,
        skipDuplicates: true,
      });
    }

    return newlyEarned.map((b) => b.badgeId);
  }

  async getMyBadges(userId: string) {
    await this.evaluateForUser(userId);
    const rows = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r.badge,
      earnedAt: r.earnedAt,
    }));
  }

  async listAllBadges(userId: string) {
    await this.evaluateForUser(userId);
    const [badges, earned] = await Promise.all([
      this.prisma.badge.findMany({
        orderBy: [{ criteriaType: 'asc' }, { criteriaValue: 'asc' }],
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
      }),
    ]);

    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));
    return badges.map((b) => {
      const earnedAt = earnedMap.get(b.id) ?? null;
      return {
        ...b,
        earned: earnedAt !== null,
        earnedAt,
      };
    });
  }
}
