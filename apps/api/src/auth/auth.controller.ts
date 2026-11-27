import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Envelope, ok } from '../common/envelope.js';
import { Role } from '../generated/prisma/client.js';
import { AuthGuard, type AuthenticatedUser } from './auth.guard.js';
import { AuthService, type JoinCohortResult } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { OtpService } from './otp.service.js';
import { normalizePhone } from './phone.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { TokenPair } from './tokens.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(
    @Body() body: { phone?: unknown },
    @Req() req: Request,
  ): Promise<Envelope<{ expiresInSeconds: number }>> {
    const phone = normalizePhone(body?.phone);
    if (!phone) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const result = await this.otp.requestCode(phone, req.ip);
    return ok(result);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() body: { phone?: unknown; code?: unknown },
  ): Promise<Envelope<TokenPair & { isNewUser: boolean }>> {
    const phone = normalizePhone(body?.phone);
    if (!phone) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Enter the 6-digit code.');
    }
    const result = await this.auth.verifyOtp(phone, code);
    return ok(result);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: { refreshToken?: unknown },
  ): Promise<Envelope<TokenPair>> {
    const token = body?.refreshToken;
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) {
      throw new BadRequestException('A refresh token is required.');
    }
    const result = await this.auth.refresh(token);
    return ok(result);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body() body: { refreshToken?: unknown },
  ): Promise<Envelope<{ loggedOut: true }>> {
    const token = body?.refreshToken;
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) {
      throw new BadRequestException('A refresh token is required.');
    }
    await this.auth.logout(token);
    return ok({ loggedOut: true });
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Envelope<{ loggedOutAll: true }>> {
    await this.auth.logoutAll(user.id);
    return ok({ loggedOutAll: true });
  }

  @Post('join-code')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @HttpCode(200)
  async joinCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { code?: unknown },
  ): Promise<Envelope<JoinCohortResult>> {
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code || code.length > 20) {
      throw new BadRequestException('Enter a valid join code.');
    }
    const result = await this.auth.joinCohort(user.id, code);
    return ok(result);
  }
}
