import {
  Controller,
  Get,
  HttpCode,
  Inject,
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
import { StoreService } from './store.service.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class StoreController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Post('store/streak-freeze')
  @HttpCode(201)
  async buyFreeze(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.store.buyStreakFreeze(user.id));
  }

  @Get('users/me/streak-freezes')
  async listFreezes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return ok(await this.store.listFreezes(user.id, status));
  }
}
