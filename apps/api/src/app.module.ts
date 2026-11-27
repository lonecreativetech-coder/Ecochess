import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BadgesModule } from './badges/badges.module.js';
import { EventsModule } from './events/events.module.js';
import { FacilitatorModule } from './facilitator/facilitator.module.js';
import { HealthController } from './health.controller.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PuzzlesModule } from './puzzles/puzzles.module.js';
import { StoreModule } from './store/store.module.js';
import { UsersModule } from './users/users.module.js';
import { WasteLogsModule } from './waste-logs/waste-logs.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    LessonsModule,
    StoreModule,
    PuzzlesModule,
    WasteLogsModule,
    EventsModule,
    BadgesModule,
    LeaderboardModule,
    FacilitatorModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
