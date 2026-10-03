import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { OtpService } from './otp.service.js';
import { normalizePhone } from './phone.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(OtpService) private readonly otp: OtpService) {}

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
}
