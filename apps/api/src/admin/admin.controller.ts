import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  // --- Schools & Cohorts ---

  @Post('schools')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  @HttpCode(201)
  async createSchool(@Body() body: Record<string, unknown>) {
    return ok(await this.admin.createSchool(body ?? {}));
  }

  @Get('schools')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  async listSchools(
    @Query('state') state?: string,
    @Query('lga') lga?: string,
  ) {
    return ok(await this.admin.listSchools(state, lga));
  }

  @Patch('schools/:id')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  async updateSchool(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.updateSchool(id, body ?? {}));
  }

  @Post('schools/:id/cohorts')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  @HttpCode(201)
  async createCohort(
    @Param('id') schoolId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.createCohort(schoolId, body ?? {}));
  }

  @Get('schools/:id/cohorts')
  @Roles(Role.FACILITATOR, Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  async listCohorts(@Param('id') schoolId: string) {
    return ok(await this.admin.listCohorts(schoolId));
  }

  @Patch('cohorts/:id')
  @Roles(Role.OPERATIONS_ADMIN, Role.PROGRAM_ADMIN)
  async updateCohort(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.updateCohort(id, body ?? {}));
  }

  @Delete('cohorts/:id')
  @Roles(Role.PROGRAM_ADMIN)
  async deactivateCohort(@Param('id') id: string) {
    return ok(await this.admin.deactivateCohort(id));
  }

  // --- Users ---

  @Get('users')
  @Roles(Role.PROGRAM_ADMIN)
  async listUsers(
    @Query('role') role?: string,
    @Query('cohort_id') cohortId?: string,
    @Query('status') status?: string,
  ) {
    return ok(await this.admin.listUsers(role, cohortId, status));
  }

  @Patch('users/:id')
  @Roles(Role.PROGRAM_ADMIN)
  async updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.updateUser(actor.id, id, body ?? {}));
  }

  @Post('users/:id/anonymize')
  @Roles(Role.PROGRAM_ADMIN)
  @HttpCode(200)
  async anonymizeUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return ok(await this.admin.anonymizeUser(actor.id, id));
  }

  // --- Content ---

  @Post('lessons')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  @HttpCode(201)
  async createLesson(@Body() body: Record<string, unknown>) {
    return ok(await this.admin.createLesson(body ?? {}));
  }

  @Patch('lessons/:id')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  async updateLesson(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.updateLesson(id, body ?? {}));
  }

  @Delete('lessons/:id')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  async deleteLesson(@Param('id') id: string) {
    return ok(await this.admin.deleteLesson(id));
  }

  @Post('puzzles')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  @HttpCode(201)
  async createPuzzle(@Body() body: Record<string, unknown>) {
    return ok(await this.admin.createPuzzle(body ?? {}));
  }

  @Patch('puzzles/:id')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  async updatePuzzle(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.admin.updatePuzzle(id, body ?? {}));
  }

  @Delete('puzzles/:id')
  @Roles(Role.CONTENT_ADMIN, Role.PROGRAM_ADMIN)
  async deletePuzzle(@Param('id') id: string) {
    return ok(await this.admin.deletePuzzle(id));
  }

  // --- Roster & Reports ---

  @Get('cohorts/:id/roster')
  @Roles(Role.FACILITATOR, Role.PROGRAM_ADMIN)
  async cohortRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cohortId: string,
  ) {
    return ok(await this.admin.getCohortRoster(user.id, user.role, cohortId));
  }

  @Get('reports/export')
  @Roles(Role.PROGRAM_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportReport(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    if (format && format.toLowerCase() !== 'csv') {
      throw new BadRequestException('Only format=csv is supported currently.');
    }
    const csv = await this.admin.exportCsvSummary();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ecochess-summary.csv"',
    );
    res.send(csv);
  }

  // --- Config & Health ---

  @Patch('config/ecoscan-conversion-rate')
  @Roles(Role.PROGRAM_ADMIN, Role.TECHNICAL_ADMIN)
  async updateConversionRate(
    @Body() body: { sachetsPerBag?: unknown; sachetsPerPiece?: unknown },
  ) {
    const sachetsPerBag = Number(body?.sachetsPerBag);
    const sachetsPerPiece = Number(body?.sachetsPerPiece);
    if (
      !Number.isFinite(sachetsPerBag) ||
      sachetsPerBag <= 0 ||
      !Number.isFinite(sachetsPerPiece) ||
      sachetsPerPiece <= 0
    ) {
      throw new BadRequestException(
        'sachetsPerBag and sachetsPerPiece must be positive numbers.',
      );
    }
    return ok(
      await this.admin.setConfig('ecoscan_conversion_rate', {
        sachetsPerBag,
        sachetsPerPiece,
      }),
    );
  }

  @Get('config/ladder-thresholds')
  @Roles(Role.PROGRAM_ADMIN)
  async getLadderThresholds() {
    return ok(await this.admin.getLadderThresholds());
  }

  @Patch('config/ladder-thresholds')
  @Roles(Role.PROGRAM_ADMIN)
  async updateLadderThresholds(@Body() body: Record<string, unknown>) {
    return ok(await this.admin.setConfig('ladder_thresholds', body ?? {}));
  }

  @Patch('config/streak-freeze-cost')
  @Roles(Role.PROGRAM_ADMIN)
  async updateStreakFreezeCost(@Body() body: { cost?: unknown }) {
    const cost = Number(body?.cost);
    if (!Number.isInteger(cost) || cost <= 0) {
      throw new BadRequestException('cost must be a positive integer.');
    }
    return ok(await this.admin.setConfig('streak_freeze_cost', cost));
  }

  @Get('system/health')
  @Roles(Role.TECHNICAL_ADMIN, Role.PROGRAM_ADMIN)
  async systemHealth() {
    return ok(await this.admin.systemHealth());
  }
}
