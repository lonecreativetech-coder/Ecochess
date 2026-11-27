import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LessonsModule } from '../lessons/lessons.module.js';
import { PuzzlesController } from './puzzles.controller.js';
import { PuzzlesService } from './puzzles.service.js';

@Module({
  imports: [AuthModule, LessonsModule],
  controllers: [PuzzlesController],
  providers: [PuzzlesService],
  exports: [PuzzlesService],
})
export class PuzzlesModule {}
