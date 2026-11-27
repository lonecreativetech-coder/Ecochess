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
import { PuzzlesService } from './puzzles.service.js';

@Controller('puzzles')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class PuzzlesController {
  constructor(@Inject(PuzzlesService) private readonly puzzles: PuzzlesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('difficulty') difficulty?: string,
  ) {
    return ok(await this.puzzles.listPuzzles(user.id, difficulty));
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return ok(await this.puzzles.getPuzzle(id));
  }

  @Post(':id/attempt')
  @HttpCode(200)
  async attempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { moves?: unknown },
  ) {
    return ok(await this.puzzles.attemptPuzzle(user.id, id, body?.moves));
  }
}
