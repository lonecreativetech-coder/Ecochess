import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { TokensService, TokenPair } from './tokens.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<TokenPair & { isNewUser: boolean }> {
    await this.otp.verifyCode(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const user =
      existing ?? (await this.prisma.user.create({ data: { phone } }));

    const pair = await this.tokens.issueTokens(user);
    return { ...pair, isNewUser: existing === null };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.refresh(refreshToken);
  }
}
