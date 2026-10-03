import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashOtp } from './hash.js';

const OTP_TTL_SECONDS = 600;
const MAX_REQUESTS = 3;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async requestCode(phone: string): Promise<{ expiresInSeconds: number }> {
    const since = new Date(Date.now() - REQUEST_WINDOW_MS);
    const recent = await this.prisma.otpCode.count({
      where: { identifier: phone, createdAt: { gte: since } },
    });
    if (recent >= MAX_REQUESTS) {
      throw new HttpException(
        'Too many code requests. Please wait and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (process.env.OTP_DELIVERY !== 'console') {
      throw new HttpException(
        'OTP delivery is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { identifier: phone, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: {
          identifier: phone,
          codeHash: hashOtp(phone, code),
          expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        },
      }),
    ]);

    this.logger.warn(`DEV ONLY - OTP for ${phone}: ${code}`);
    return { expiresInSeconds: OTP_TTL_SECONDS };
  }
}
