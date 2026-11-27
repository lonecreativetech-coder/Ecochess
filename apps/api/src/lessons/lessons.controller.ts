import {
  Body,
  Controller,
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
import { LessonsService } from './lessons.service.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessons: LessonsService) {}

  @Get('lessons')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('track') track?: string,
  ) {
    return ok(await this.lessons.listLessons(user.id, track));
  }

  @Get('lessons/:id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.lessons.getLesson(user.id, id));
  }

  @Post('lessons/:id/complete')
  @HttpCode(200)
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.lessons.completeLesson(user.id, id));
  }

  @Post('sync')
  @HttpCode(200)
  async sync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { completions?: unknown },
  ) {
    return ok(
      await this.lessons.syncOfflineCompletions(user.id, body?.completions),
    );
  }

  @Get('users/me/progress')
  async progress(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.lessons.getUserProgress(user.id));
  }
}
