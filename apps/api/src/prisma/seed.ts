import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BadgeCriteriaType,
  JoinCodeType,
  LessonTrack,
  PrismaClient,
  Role,
} from '../generated/prisma/client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Check apps/api/.env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. School & Cohorts
    const school = await prisma.school.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Festard Schools',
        location: 'Festac Town, Lagos',
        lga: 'Amuwo-Odofin',
        state: 'Lagos',
      },
    });

    const cohortA = await prisma.cohort.upsert({
      where: { id: '00000000-0000-0000-0000-000000000011' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Cohort A',
        schoolId: school.id,
        academicYear: '2026',
      },
    });

    const cohortB = await prisma.cohort.upsert({
      where: { id: '00000000-0000-0000-0000-000000000012' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000012',
        name: 'Cohort B',
        schoolId: school.id,
        academicYear: '2026',
      },
    });

    // 2. Users (one per role)
    const facilitator = await prisma.user.upsert({
      where: { phone: '+2348000000002' },
      update: {},
      create: {
        name: 'Ada Facilitator',
        phone: '+2348000000002',
        role: Role.FACILITATOR,
      },
    });

    await prisma.cohortFacilitator.upsert({
      where: {
        cohortId_userId: { cohortId: cohortA.id, userId: facilitator.id },
      },
      update: {},
      create: { cohortId: cohortA.id, userId: facilitator.id },
    });

    await prisma.user.upsert({
      where: { phone: '+2348000000001' },
      update: {},
      create: {
        name: 'Tolu Student',
        phone: '+2348000000001',
        ageBand: '10_13',
        role: Role.STUDENT,
        cohortId: cohortA.id,
      },
    });

    const adminUsers: Array<{ name: string; phone: string; role: Role }> = [
      { name: 'Program Admin', phone: '+2348000000003', role: Role.PROGRAM_ADMIN },
      { name: 'Ops Admin', phone: '+2348000000004', role: Role.OPERATIONS_ADMIN },
      { name: 'Content Admin', phone: '+2348000000005', role: Role.CONTENT_ADMIN },
      { name: 'Tech Admin', phone: '+2348000000006', role: Role.TECHNICAL_ADMIN },
    ];
    for (const u of adminUsers) {
      await prisma.user.upsert({
        where: { phone: u.phone },
        update: {},
        create: u,
      });
    }

    // 3. Sample Join Code
    await prisma.joinCode.upsert({
      where: { code: 'FEST-2026' },
      update: {},
      create: {
        code: 'FEST-2026',
        cohortId: cohortA.id,
        createdById: facilitator.id,
        type: JoinCodeType.MULTI_USE,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    // 4. Lessons
    const lessons = [
      {
        id: '00000000-0000-0000-0000-000000000101',
        title: 'Chess Tactics: The Fork',
        track: LessonTrack.CHESS_TACTICS,
        order: 1,
        xpValue: 50,
        contentPayload: {
          cards: [
            { type: 'text', body: 'A fork attacks two pieces at once.' },
            {
              type: 'multiple_choice',
              question: 'Which piece is famous for royal forks?',
              options: ['Knight', 'Pawn', 'King'],
              answer: 'Knight',
            },
          ],
        },
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        title: 'Chess Tactics: The Pin',
        track: LessonTrack.CHESS_TACTICS,
        order: 2,
        xpValue: 50,
        contentPayload: {
          cards: [
            { type: 'text', body: 'A pin traps a piece in front of a more valuable one.' },
          ],
        },
      },
      {
        id: '00000000-0000-0000-0000-000000000201',
        title: 'Where Does a Sachet Go?',
        track: LessonTrack.ECO_LITERACY,
        order: 1,
        xpValue: 50,
        contentPayload: {
          cards: [
            { type: 'text', body: 'Plastic sachets can be collected and upcycled into chess pieces.' },
          ],
        },
      },
      {
        id: '00000000-0000-0000-0000-000000000202',
        title: 'Sorting Waste at School',
        track: LessonTrack.ECO_LITERACY,
        order: 2,
        xpValue: 50,
        contentPayload: {
          cards: [
            { type: 'text', body: 'Keep clean sachets separate from organic waste.' },
          ],
        },
      },
    ];
    for (const l of lessons) {
      await prisma.lesson.upsert({
        where: { id: l.id },
        update: {},
        create: l,
      });
    }

    // 5. Puzzles
    const puzzles = [
      {
        id: '00000000-0000-0000-0000-000000000301',
        title: 'Find the Knight Fork',
        difficultyTier: 1,
        boardPosition: '4k3/8/8/8/8/5N2/8/4K2R w - - 0 1',
        solution: ['Nf3-g5', 'Ng5-f7'],
        hintText: 'Look for a square where your knight attacks two targets at once.',
        xpValue: 25,
      },
      {
        id: '00000000-0000-0000-0000-000000000302',
        title: 'Back Rank Mate in 1',
        difficultyTier: 2,
        boardPosition: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
        solution: ['Ra1-a8#'],
        hintText: 'The black king has no escape squares on the back rank.',
        xpValue: 35,
      },
    ];
    for (const p of puzzles) {
      await prisma.puzzle.upsert({
        where: { id: p.id },
        update: {},
        create: p,
      });
    }

    // 6. MVP Badges
    const badges = [
      {
        slug: 'first_lesson',
        name: 'First Steps',
        description: 'Completed your first lesson',
        iconRef: 'badges/first_lesson.png',
        criteriaType: BadgeCriteriaType.LESSON_COUNT,
        criteriaValue: 1,
      },
      {
        slug: 'eco_starter',
        name: 'Eco Starter',
        description: 'Logged your first approved waste collection',
        iconRef: 'badges/eco_starter.png',
        criteriaType: BadgeCriteriaType.WASTE_LOG_COUNT,
        criteriaValue: 1,
      },
      {
        slug: 'week_warrior',
        name: 'Week Warrior',
        description: 'Maintained a 7-day learning streak',
        iconRef: 'badges/week_warrior.png',
        criteriaType: BadgeCriteriaType.STREAK_DAYS,
        criteriaValue: 7,
      },
      {
        slug: 'rank_sapling',
        name: 'Sapling',
        description: 'Reached Sapling rank (500 XP)',
        iconRef: 'badges/sapling.png',
        criteriaType: BadgeCriteriaType.RANK_REACHED,
        criteriaValue: 2,
      },
      {
        slug: 'rank_dam_builder',
        name: 'Dam Builder',
        description: 'Reached Dam Builder rank (1,500 XP)',
        iconRef: 'badges/dam_builder.png',
        criteriaType: BadgeCriteriaType.RANK_REACHED,
        criteriaValue: 3,
      },
      {
        slug: 'rank_ocean_guardian',
        name: 'Ocean Guardian',
        description: 'Reached Ocean Guardian rank (13,000 XP)',
        iconRef: 'badges/ocean_guardian.png',
        criteriaType: BadgeCriteriaType.RANK_REACHED,
        criteriaValue: 6,
      },
    ];
    for (const b of badges) {
      await prisma.badge.upsert({
        where: { slug: b.slug },
        update: {},
        create: b,
      });
    }

    // 7. Default AppConfig
    const configs: Array<{ key: string; value: object | number }> = [
      { key: 'streak_freeze_cost', value: 50 },
      { key: 'streak_freeze_max', value: 2 },
      { key: 'ecoscan_xp_per_log', value: 20 },
      {
        key: 'ecoscan_conversion_rate',
        value: { sachetsPerBag: 50, sachetsPerPiece: 500 },
      },
    ];
    for (const c of configs) {
      await prisma.appConfig.upsert({
        where: { key: c.key },
        update: {},
        create: { key: c.key, value: c.value as object },
      });
    }

    console.log(
      `Seeded: ${school.name}, ${cohortA.name}, ${cohortB.name}, 6 users, 4 lessons, 2 puzzles, 6 badges.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
