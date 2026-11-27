import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import { FacilitatorService } from './facilitator.service.js';

@Controller('facilitator')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.FACILITATOR, Role.PROGRAM_ADMIN)
export class FacilitatorController {
  constructor(
    @Inject(FacilitatorService)
    private readonly facilitator: FacilitatorService,
  ) {}

  @Post('join-codes')
  @HttpCode(201)
  async createJoinCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(
      await this.facilitator.createJoinCode(user.id, user.role, body ?? {}),
    );
  }

  @Get('join-codes')
  async listJoinCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cohort_id') cohortId?: string,
  ) {
    return ok(
      await this.facilitator.listJoinCodes(user.id, user.role, cohortId),
    );
  }

  @Delete('join-codes/:id')
  async revokeJoinCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.facilitator.revokeJoinCode(user.id, user.role, id));
  }

  @Get('cohorts/:id/progress')
  async cohortProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cohortId: string,
  ) {
    return ok(
      await this.facilitator.getCohortProgress(user.id, user.role, cohortId),
    );
  }
}
