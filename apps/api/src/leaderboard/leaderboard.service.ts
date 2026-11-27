import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { LeaderboardScope, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

function parseScope(raw?: string): LeaderboardScope {
  if (!raw) return LeaderboardScope.INDIVIDUAL;
  const upper = raw.trim().toUpperCase();
  if (
    upper === LeaderboardScope.INDIVIDUAL ||
    upper === LeaderboardScope.SCHOOL ||
    upper === LeaderboardScope.COHORT
  ) {
    return upper;
  }
  throw new BadRequestException(
    'scope must be individual, school, or cohort.',
  );
}

@Injectable()
export class LeaderboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recalculate(period = 'all-time'): Promise<void> {
    const [students, cohorts, schools] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.STUDENT, deletedAt: null },
        select: {
          id: true,
          name: true,
          cohortId: true,
          lifetimeGreenPoints: true,
        },
        orderBy: [{ lifetimeGreenPoints: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.cohort.findMany({
        where: { isActive: true },
        select: { id: true, name: true, schoolId: true },
      }),
      this.prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    const cohortTotals = new Map<string, number>();
    for (const s of students) {
      if (s.cohortId) {
        cohortTotals.set(
          s.cohortId,
          (cohortTotals.get(s.cohortId) ?? 0) + s.lifetimeGreenPoints,
        );
      }
    }

    const schoolTotals = new Map<string, number>();
    for (const c of cohorts) {
      const xp = cohortTotals.get(c.id) ?? 0;
      schoolTotals.set(c.schoolId, (schoolTotals.get(c.schoolId) ?? 0) + xp);
    }

    const sortedCohorts = cohorts
      .map((c) => ({
        entityId: c.id,
        entityName: c.name,
        xpTotal: cohortTotals.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.xpTotal - a.xpTotal);

    const sortedSchools = schools
      .map((s) => ({
        entityId: s.id,
        entityName: s.name,
        xpTotal: schoolTotals.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.xpTotal - a.xpTotal);

    const rows = [
      ...students.map((s, i) => ({
        scope: LeaderboardScope.INDIVIDUAL,
        period,
        entityId: s.id,
        entityName: s.name ?? 'Student',
        xpTotal: s.lifetimeGreenPoints,
        rank: i + 1,
      })),
      ...sortedCohorts.map((c, i) => ({
        scope: LeaderboardScope.COHORT,
        period,
        entityId: c.entityId,
        entityName: c.entityName,
        xpTotal: c.xpTotal,
        rank: i + 1,
      })),
      ...sortedSchools.map((s, i) => ({
        scope: LeaderboardScope.SCHOOL,
        period,
        entityId: s.entityId,
        entityName: s.entityName,
        xpTotal: s.xpTotal,
        rank: i + 1,
      })),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.leaderboardEntry.deleteMany({ where: { period } });
      if (rows.length > 0) {
        await tx.leaderboardEntry.createMany({ data: rows });
      }
    });
  }

  async getLeaderboard(
    rawScope?: string,
    rawPeriod?: string,
    rawPage?: string,
    rawPageSize?: string,
  ) {
    const scope = parseScope(rawScope);
    const period = rawPeriod?.trim() || 'all-time';
    const page = Math.max(1, Number(rawPage) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(rawPageSize) || 25));

    let totalCount = await this.prisma.leaderboardEntry.count({
      where: { scope, period },
    });

    if (totalCount === 0) {
      await this.recalculate(period);
      totalCount = await this.prisma.leaderboardEntry.count({
        where: { scope, period },
      });
    }

    const items = await this.prisma.leaderboardEntry.findMany({
      where: { scope, period },
      orderBy: { rank: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      updatedAt: items[0]?.updatedAt ?? null,
      meta: { page, pageSize, totalCount },
    };
  }

  async getMyRank(userId: string, rawPeriod?: string) {
    const period = rawPeriod?.trim() || 'all-time';
    let entry = await this.prisma.leaderboardEntry.findUnique({
      where: {
        scope_period_entityId: {
          scope: LeaderboardScope.INDIVIDUAL,
          period,
          entityId: userId,
        },
      },
    });

    if (!entry) {
      await this.recalculate(period);
      entry = await this.prisma.leaderboardEntry.findUnique({
        where: {
          scope_period_entityId: {
            scope: LeaderboardScope.INDIVIDUAL,
            period,
            entityId: userId,
          },
        },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { cohort: { select: { id: true, schoolId: true } } },
    });

    const schoolEntry = user?.cohort?.schoolId
      ? await this.prisma.leaderboardEntry.findUnique({
          where: {
            scope_period_entityId: {
              scope: LeaderboardScope.SCHOOL,
              period,
              entityId: user.cohort.schoolId,
            },
          },
        })
      : null;

    return {
      individual: entry,
      school: schoolEntry,
    };
  }
}
