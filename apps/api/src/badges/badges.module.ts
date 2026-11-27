import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BadgesController } from './badges.controller.js';
import { BadgesService } from './badges.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
