import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StreakFreezeStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_FREEZE_COST = 50;
const DEFAULT_MAX_FREEZES = 2;
const FREEZE_SHELF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class StoreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async getFreezeConfig(): Promise<{ cost: number; maxHeld: number }> {
    const [costCfg, maxCfg] = await Promise.all([
      this.prisma.appConfig.findUnique({ where: { key: 'streak_freeze_cost' } }),
      this.prisma.appConfig.findUnique({ where: { key: 'streak_freeze_max' } }),
    ]);

    const cost =
      typeof costCfg?.value === 'number' && costCfg.value > 0
        ? costCfg.value
        : DEFAULT_FREEZE_COST;
    const maxHeld =
      typeof maxCfg?.value === 'number' && maxCfg.value > 0
        ? maxCfg.value
        : DEFAULT_MAX_FREEZES;

    return { cost, maxHeld };
  }

  async buyStreakFreeze(userId: string) {
    const { cost, maxHeld } = await this.getFreezeConfig();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt !== null) {
        throw new NotFoundException();
      }

      const activeCount = await tx.streakFreeze.count({
        where: {
          userId,
          status: StreakFreezeStatus.AVAILABLE,
          expiresAt: { gt: now },
        },
      });

      if (activeCount >= maxHeld) {
        throw new BadRequestException({
          code: 'MAX_FREEZES_HELD',
          message: `You can hold at most ${maxHeld} streak freezes at a time.`,
        });
      }

      if (user.greenPointBalance < cost) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_GREEN_POINTS',
          message: `You need ${cost} Green Points to buy a streak freeze.`,
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { greenPointBalance: { decrement: cost } },
      });

      const freeze = await tx.streakFreeze.create({
        data: {
          userId,
          gpCost: cost,
          status: StreakFreezeStatus.AVAILABLE,
          expiresAt: new Date(now.getTime() + FREEZE_SHELF_LIFE_MS),
        },
      });

      return {
        freeze,
        greenPointBalance: updatedUser.greenPointBalance,
      };
    });
  }

  async listFreezes(userId: string, rawStatus?: string) {
    let status: StreakFreezeStatus | undefined;
    if (rawStatus) {
      const upper = rawStatus.trim().toUpperCase();
      if (
        upper === StreakFreezeStatus.AVAILABLE ||
        upper === StreakFreezeStatus.USED ||
        upper === StreakFreezeStatus.EXPIRED
      ) {
        status = upper;
      } else {
        throw new BadRequestException(
          'status must be available, used, or expired.',
        );
      }
    }

    return this.prisma.streakFreeze.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { purchasedAt: 'desc' },
    });
  }
}
