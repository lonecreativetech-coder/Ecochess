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
import { TokenPair } from './tokens.service.js';

type Envelope<T> = { data: T; error: null; meta: null };

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
  ): Promise<Envelope<{ expiresInSeconds: number }>> {
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
    return { data: result, error: null, meta: null };
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
    return { data: result, error: null, meta: null };
  }
}
