import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashOtp } from './hash.js';

const OTP_TTL_SECONDS = 300;
const MAX_REQUESTS_PER_PHONE = 3;
const PHONE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 10;
const IP_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ipHits = new Map<string, number[]>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private checkIpRateLimit(ip?: string): void {
    if (!ip) return;
    const now = Date.now();
    const cutoff = now - IP_WINDOW_MS;
    const recent = (this.ipHits.get(ip) ?? []).filter((ts) => ts >= cutoff);
    if (recent.length >= MAX_REQUESTS_PER_IP) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests from this IP. Please wait and try again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.ipHits.set(ip, recent);
  }

  async requestCode(
    phone: string,
    ip?: string,
  ): Promise<{ expiresInSeconds: number }> {
    this.checkIpRateLimit(ip);

    const since = new Date(Date.now() - PHONE_WINDOW_MS);
    const recent = await this.prisma.otpCode.count({
      where: { identifier: phone, createdAt: { gte: since } },
    });
    if (recent >= MAX_REQUESTS_PER_PHONE) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many code requests. Please wait and try again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (process.env.OTP_DELIVERY !== 'console') {
      throw new HttpException(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: 'OTP delivery is not configured.',
        },
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

  async verifyCode(phone: string, code: string): Promise<void> {
    const invalid = (): UnauthorizedException =>
      new UnauthorizedException('Invalid or expired code.');

    const record = await this.prisma.otpCode.findFirst({
      where: { identifier: phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw invalid();
    }

    const claimed = await this.prisma.otpCode.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw invalid();
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(hashOtp(phone, code), 'hex');
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      if (record.attempts + 1 >= MAX_ATTEMPTS) {
        await this.prisma.otpCode.updateMany({
          where: { id: record.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
      }
      throw invalid();
    }

    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw invalid();
    }
  }
}
