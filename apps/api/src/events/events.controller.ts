import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
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
import { EventsService } from './events.service.js';

@Controller('events')
@UseGuards(AuthGuard, RolesGuard)
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @Roles(Role.STUDENT)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
  ) {
    return ok(await this.events.listForStudent(user.id, type));
  }

  @Get(':id')
  @Roles(Role.STUDENT)
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.events.getOne(user.id, id));
  }

  @Post(':id/register')
  @Roles(Role.STUDENT)
  @HttpCode(201)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.events.register(user.id, id));
  }

  @Delete(':id/register')
  @Roles(Role.STUDENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.events.cancelRegistration(user.id, id));
  }

  @Post()
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.events.create(user.id, body ?? {}));
  }

  @Patch(':id')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.events.update(id, body ?? {}));
  }
}
