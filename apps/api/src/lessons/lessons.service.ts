import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonTrack,
  StreakFreezeStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankFor } from '../users/ladder.js';
import {
  ProgressionService,
  type ProgressionResult,
} from './progression.service.js';

function parseTrack(raw?: string): LessonTrack | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'chess' || v === 'chess_tactics') return LessonTrack.CHESS_TACTICS;
  if (v === 'eco' || v === 'eco_literacy') return LessonTrack.ECO_LITERACY;
  throw new BadRequestException('track must be "chess" or "eco".');
}

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progression: ProgressionService,
  ) {}

  async listLessons(userId: string, rawTrack?: string) {
    const track = parseTrack(rawTrack);
    const [lessons, completions] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { isActive: true, ...(track ? { track } : {}) },
        orderBy: [{ track: 'asc' }, { order: 'asc' }],
        select: {
          id: true,
          title: true,
          track: true,
          order: true,
          xpValue: true,
        },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { userId },
        select: { lessonId: true, completedAt: true },
      }),
    ]);

    const completedMap = new Map(
      completions.map((c) => [c.lessonId, c.completedAt]),
    );

    return lessons.map((lesson) => {
      const completedAt = completedMap.get(lesson.id) ?? null;
      return {
        ...lesson,
        completed: completedAt !== null,
        completedAt,
      };
    });
  }

  async getLesson(userId: string, lessonId: string) {
    const [lesson, completion] = await Promise.all([
      this.prisma.lesson.findFirst({
        where: { id: lessonId, isActive: true },
      }),
      this.prisma.lessonCompletion.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      }),
    ]);

    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    return {
      ...lesson,
      completed: completion !== null,
      completedAt: completion?.completedAt ?? null,
    };
  }

  async completeLesson(
    userId: string,
    lessonId: string,
    completedAt?: Date,
  ): Promise<{
    alreadyCompleted: boolean;
    xpAwarded: number;
    progress: ProgressionResult;
  }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, isActive: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.lessonCompletion.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      });

      if (existing) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
        });
        return {
          alreadyCompleted: true,
          xpAwarded: 0,
          progress: {
            lifetimeGreenPoints: user.lifetimeGreenPoints,
            greenPointBalance: user.greenPointBalance,
            streakCount: user.streakCount,
            rank: rankFor(user.lifetimeGreenPoints),
            rankedUp: false,
          },
        };
      }

      await tx.lessonCompletion.create({
        data: {
          userId,
          lessonId,
          xpAwarded: lesson.xpValue,
          ...(completedAt ? { completedAt } : {}),
        },
      });

      const progress = await this.progression.awardPoints(
        tx,
        userId,
        lesson.xpValue,
        { countForStreak: true, now: completedAt },
      );

      return {
        alreadyCompleted: false,
        xpAwarded: lesson.xpValue,
        progress,
      };
    });
  }

  async syncOfflineCompletions(userId: string, rawCompletions: unknown) {
    if (!Array.isArray(rawCompletions)) {
      throw new BadRequestException('completions must be an array.');
    }

    const accepted: string[] = [];
    const rejected: Array<{ lessonId: string; reason: string }> = [];

    for (const item of rawCompletions) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).lessonId !== 'string'
      ) {
        continue;
      }
      const rec = item as { lessonId: string; completedAt?: unknown };
      const parsedDate =
        typeof rec.completedAt === 'string'
          ? new Date(rec.completedAt)
          : new Date();
      const validDate = Number.isNaN(parsedDate.getTime())
        ? new Date()
        : parsedDate;

      try {
        await this.completeLesson(userId, rec.lessonId, validDate);
        accepted.push(rec.lessonId);
      } catch {
        rejected.push({ lessonId: rec.lessonId, reason: 'lesson_not_found' });
      }
    }

    const catalog = await this.listLessons(userId);
    return { accepted, rejected, catalog };
  }

  async getUserProgress(userId: string) {
    const [user, freezesHeld, lessonsCompleted] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.streakFreeze.count({
        where: {
          userId,
          status: StreakFreezeStatus.AVAILABLE,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.lessonCompletion.count({ where: { userId } }),
    ]);

    if (!user || user.deletedAt !== null) {
      throw new NotFoundException();
    }

    return {
      lifetimeGreenPoints: user.lifetimeGreenPoints,
      greenPointBalance: user.greenPointBalance,
      streakCount: user.streakCount,
      freezesHeld,
      lessonsCompleted,
      rank: rankFor(user.lifetimeGreenPoints),
    };
  }
}
