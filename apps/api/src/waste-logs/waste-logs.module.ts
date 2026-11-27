import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LessonsModule } from '../lessons/lessons.module.js';
import { WasteLogsController } from './waste-logs.controller.js';
import { WasteLogsService } from './waste-logs.service.js';

@Module({
  imports: [AuthModule, LessonsModule],
  controllers: [WasteLogsController],
  providers: [WasteLogsService],
  exports: [WasteLogsService],
})
export class WasteLogsModule {}
