import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressionService } from '../lessons/progression.service.js';
import { rankFor } from '../users/ladder.js';

@Injectable()
export class PuzzlesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progression: ProgressionService,
  ) {}

  async listPuzzles(userId: string, rawDifficulty?: string) {
    let maxTier: number | undefined;
    if (rawDifficulty !== undefined && rawDifficulty !== '') {
      const parsed = Number(rawDifficulty);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new BadRequestException('difficulty must be a positive integer.');
      }
      maxTier = parsed;
    }

    const [puzzles, solvedAttempts] = await Promise.all([
      this.prisma.puzzle.findMany({
        where: {
          isActive: true,
          ...(maxTier !== undefined ? { difficultyTier: { lte: maxTier } } : {}),
        },
        orderBy: [{ difficultyTier: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          difficultyTier: true,
          xpValue: true,
        },
      }),
      this.prisma.puzzleAttempt.findMany({
        where: { userId, isCorrect: true },
        select: { puzzleId: true },
        distinct: ['puzzleId'],
      }),
    ]);

    const solvedSet = new Set(solvedAttempts.map((a) => a.puzzleId));
    return puzzles.map((p) => ({
      ...p,
      solved: solvedSet.has(p.id),
    }));
  }

  async getPuzzle(puzzleId: string) {
    const puzzle = await this.prisma.puzzle.findFirst({
      where: { id: puzzleId, isActive: true },
      select: {
        id: true,
        title: true,
        difficultyTier: true,
        boardPosition: true,
        hintText: true,
        xpValue: true,
      },
    });
    if (!puzzle) {
      throw new NotFoundException('Puzzle not found.');
    }
    return puzzle;
  }

  async attemptPuzzle(userId: string, puzzleId: string, rawMoves: unknown) {
    if (
      !Array.isArray(rawMoves) ||
      rawMoves.length === 0 ||
      !rawMoves.every((m) => typeof m === 'string' && m.trim().length > 0)
    ) {
      throw new BadRequestException('moves must be a non-empty array of strings.');
    }

    const moves = rawMoves.map((m) => (m as string).trim());
    const puzzle = await this.prisma.puzzle.findFirst({
      where: { id: puzzleId, isActive: true },
    });
    if (!puzzle) {
      throw new NotFoundException('Puzzle not found.');
    }

    const expected = Array.isArray(puzzle.solution)
      ? puzzle.solution.map((m) => String(m).trim())
      : [];
    const isCorrect =
      expected.length === moves.length &&
      expected.every((m, idx) => m === moves[idx]);

    if (!isCorrect) {
      await this.prisma.puzzleAttempt.create({
        data: {
          userId,
          puzzleId,
          moves,
          isCorrect: false,
          xpAwarded: 0,
        },
      });
      return {
        correct: false,
        hintText: puzzle.hintText,
        xpAwarded: 0,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const priorSolve = await tx.puzzleAttempt.findFirst({
        where: { userId, puzzleId, isCorrect: true },
      });

      const xpAwarded = priorSolve ? 0 : puzzle.xpValue;

      await tx.puzzleAttempt.create({
        data: {
          userId,
          puzzleId,
          moves,
          isCorrect: true,
          xpAwarded,
        },
      });

      if (xpAwarded > 0) {
        const progress = await this.progression.awardPoints(
          tx,
          userId,
          xpAwarded,
          { countForStreak: false },
        );
        return {
          correct: true,
          alreadySolved: false,
          xpAwarded,
          progress,
        };
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return {
        correct: true,
        alreadySolved: true,
        xpAwarded: 0,
        progress: {
          lifetimeGreenPoints: user.lifetimeGreenPoints,
          greenPointBalance: user.greenPointBalance,
          streakCount: user.streakCount,
          rank: rankFor(user.lifetimeGreenPoints),
          rankedUp: false,
        },
      };
    });
  }
}
