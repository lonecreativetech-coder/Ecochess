import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressionService } from '../src/lessons/progression.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';

function createMockTx(initial: {
  lifetimeGreenPoints: number;
  greenPointBalance: number;
  streakCount: number;
  streakLastDate: Date | null;
}) {
  const state = { ...initial };
  const tx = {
    user: {
      findUnique: async () => ({ id: 'u1', ...state }),
      update: async ({
        data,
      }: {
        data: {
          lifetimeGreenPoints: { increment: number };
          greenPointBalance: { increment: number };
          streakCount?: number;
          streakLastDate?: Date;
        };
      }) => {
        state.lifetimeGreenPoints += data.lifetimeGreenPoints.increment;
        state.greenPointBalance += data.greenPointBalance.increment;
        if (data.streakCount !== undefined) state.streakCount = data.streakCount;
        if (data.streakLastDate !== undefined) {
          state.streakLastDate = data.streakLastDate;
        }
        return { id: 'u1', ...state };
      },
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, state };
}

test('ProgressionService increments streak once per WAT day and detects rank-up', async () => {
  const service = new ProgressionService();
  const day1 = new Date('2026-11-25T10:00:00+01:00');
  const day1Evening = new Date('2026-11-25T21:00:00+01:00');
  const day2 = new Date('2026-11-26T09:00:00+01:00');
  const day5 = new Date('2026-11-29T09:00:00+01:00');

  const { tx, state } = createMockTx({
    lifetimeGreenPoints: 460,
    greenPointBalance: 100,
    streakCount: 0,
    streakLastDate: null,
  });

  // First lesson -> streak 1, still Sprout (460 + 20 = 480)
  const r1 = await service.awardPoints(tx, 'u1', 20, {
    countForStreak: true,
    now: day1,
  });
  assert.equal(r1.streakCount, 1);
  assert.equal(r1.rankedUp, false);

  // Same WAT day -> streak stays 1, rank-up to Sapling (480 + 30 = 510)
  const r2 = await service.awardPoints(tx, 'u1', 30, {
    countForStreak: true,
    now: day1Evening,
  });
  assert.equal(r2.streakCount, 1);
  assert.equal(r2.rankedUp, true);
  assert.equal(r2.rank.name, 'Sapling');

  // Next WAT day -> streak increments to 2
  const r3 = await service.awardPoints(tx, 'u1', 50, {
    countForStreak: true,
    now: day2,
  });
  assert.equal(r3.streakCount, 2);

  // Missed days -> streak resets to 1, XP & GP preserved
  const r4 = await service.awardPoints(tx, 'u1', 50, {
    countForStreak: true,
    now: day5,
  });
  assert.equal(r4.streakCount, 1);
  assert.equal(state.lifetimeGreenPoints, 610);
  assert.equal(state.greenPointBalance, 250);
});
