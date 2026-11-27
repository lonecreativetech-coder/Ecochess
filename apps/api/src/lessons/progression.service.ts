import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { rankFor, type RankInfo } from '../users/ladder.js';

const WAT_OFFSET_MS = 60 * 60 * 1000;

function watDayKey(date: Date): string {
  const wat = new Date(date.getTime() + WAT_OFFSET_MS);
  return wat.toISOString().slice(0, 10);
}

function watYesterdayKey(date: Date): string {
  const watYesterday = new Date(
    date.getTime() + WAT_OFFSET_MS - 24 * 60 * 60 * 1000,
  );
  return watYesterday.toISOString().slice(0, 10);
}

export interface ProgressionResult {
  lifetimeGreenPoints: number;
  greenPointBalance: number;
  streakCount: number;
  rank: RankInfo;
  rankedUp: boolean;
}

@Injectable()
export class ProgressionService {
  async awardPoints(
    tx: Prisma.TransactionClient,
    userId: string,
    pointsDelta: number,
    options: { countForStreak?: boolean; now?: Date } = {},
  ): Promise<ProgressionResult> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }

    const now = options.now ?? new Date();
    let streakCount = user.streakCount;
    let streakLastDate = user.streakLastDate;

    if (options.countForStreak) {
      const todayKey = watDayKey(now);
      const lastKey = streakLastDate ? watDayKey(streakLastDate) : null;

      if (lastKey === todayKey) {
        // Already completed a lesson in this 24h WAT window
      } else if (lastKey === watYesterdayKey(now)) {
        streakCount += 1;
        streakLastDate = now;
      } else {
        streakCount = 1;
        streakLastDate = now;
      }
    }

    const prevRank = rankFor(user.lifetimeGreenPoints);
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        lifetimeGreenPoints: { increment: pointsDelta },
        greenPointBalance: { increment: pointsDelta },
        ...(options.countForStreak ? { streakCount, streakLastDate } : {}),
      },
    });
    const nextRank = rankFor(updated.lifetimeGreenPoints);

    return {
      lifetimeGreenPoints: updated.lifetimeGreenPoints,
      greenPointBalance: updated.greenPointBalance,
      streakCount: updated.streakCount,
      rank: nextRank,
      rankedUp: nextRank.tier > prevRank.tier,
    };
  }
}
