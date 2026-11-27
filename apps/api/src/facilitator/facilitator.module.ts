import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FacilitatorController } from './facilitator.controller.js';
import { FacilitatorService } from './facilitator.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FacilitatorController],
  providers: [FacilitatorService],
  exports: [FacilitatorService],
})
export class FacilitatorModule {}
