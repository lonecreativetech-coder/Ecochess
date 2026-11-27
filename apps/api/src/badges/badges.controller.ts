import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import { BadgesService } from './badges.service.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class BadgesController {
  constructor(@Inject(BadgesService) private readonly badges: BadgesService) {}

  @Get('users/me/badges')
  async myBadges(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.badges.getMyBadges(user.id));
  }

  @Get('badges')
  async listAll(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.badges.listAllBadges(user.id));
  }
}
