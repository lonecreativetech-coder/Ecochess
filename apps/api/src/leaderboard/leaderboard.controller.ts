import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import { LeaderboardService } from './leaderboard.service.js';

@Controller('leaderboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class LeaderboardController {
  constructor(
    @Inject(LeaderboardService) private readonly leaderboard: LeaderboardService,
  ) {}

  @Get()
  async list(
    @Query('scope') scope?: string,
    @Query('period') period?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const result = await this.leaderboard.getLeaderboard(
      scope,
      period,
      page,
      pageSize,
    );
    return ok(
      { items: result.items, updatedAt: result.updatedAt },
      result.meta,
    );
  }

  @Get('me')
  async me(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period?: string,
  ) {
    return ok(await this.leaderboard.getMyRank(user.id, period));
  }
}
