import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ userId: string; isNewUser: boolean }> {
    await this.otp.verifyCode(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return { userId: existing.id, isNewUser: false };
    }

    const created = await this.prisma.user.create({ data: { phone } });
    return { userId: created.id, isNewUser: true };
  }
}
