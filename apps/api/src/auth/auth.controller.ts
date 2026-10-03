import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { normalizePhone } from './phone.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() body: { phone?: unknown }): Promise<{
    data: { expiresInSeconds: number };
    error: null;
    meta: null;
  }> {
    const phone = normalizePhone(body?.phone);
    if (!phone) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const result = await this.otp.requestCode(phone);
    return { data: result, error: null, meta: null };
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() body: { phone?: unknown; code?: unknown },
  ): Promise<{
    data: { userId: string; isNewUser: boolean };
    error: null;
    meta: null;
  }> {
    const phone = normalizePhone(body?.phone);
    if (!phone) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Enter the 6-digit code.');
    }
    const result = await this.auth.verifyOtp(phone, code);
    return { data: result, error: null, meta: null };
  }
}
