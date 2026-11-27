import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import {
  WasteLogsService,
  type UploadedPhoto,
} from './waste-logs.service.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class WasteLogsController {
  constructor(
    @Inject(WasteLogsService) private readonly wasteLogs: WasteLogsService,
  ) {}

  @Post('waste-logs')
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @HttpCode(201)
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { bagCount?: unknown },
    @UploadedFile() photo?: UploadedPhoto,
  ) {
    return ok(await this.wasteLogs.submit(user.id, body?.bagCount, photo));
  }

  @Get('users/me/waste-logs')
  @Roles(Role.STUDENT)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return ok(await this.wasteLogs.listMine(user.id, status));
  }

  @Patch('waste-logs/:id/resubmit')
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { bagCount?: unknown },
    @UploadedFile() photo?: UploadedPhoto,
  ) {
    return ok(
      await this.wasteLogs.resubmit(user.id, id, body?.bagCount, photo),
    );
  }

  @Get('waste-logs')
  @Roles(Role.FACILITATOR, Role.PROGRAM_ADMIN)
  async listQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('cohort_id') cohortId?: string,
  ) {
    return ok(
      await this.wasteLogs.listQueue(user.id, user.role, status, cohortId),
    );
  }

  @Patch('waste-logs/:id')
  @Roles(Role.FACILITATOR, Role.PROGRAM_ADMIN)
  async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { decision?: unknown; status?: unknown; note?: unknown },
  ) {
    return ok(
      await this.wasteLogs.review(
        user.id,
        user.role,
        id,
        body?.decision ?? body?.status,
        body?.note,
      ),
    );
  }

  @Get('cohorts/:id/waste-totals')
  async cohortTotals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cohortId: string,
  ) {
    return ok(
      await this.wasteLogs.getCohortTotals(user.id, user.role, cohortId),
    );
  }
}
