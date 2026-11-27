import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { TokensService, TokenPair } from './tokens.service.js';

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export interface JoinCohortResult {
  cohortId: string;
  cohortName: string;
  schoolId: string;
  schoolName: string;
}

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
    let user = existing;

    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
    } else if (user.deletedAt !== null) {
      const elapsed = Date.now() - user.deletedAt.getTime();
      if (elapsed <= GRACE_PERIOD_MS) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { deletedAt: null },
        });
      } else {
        throw new GoneException({
          code: 'ACCOUNT_DELETED',
          message: 'This account has been permanently deleted.',
        });
      }
    }

    const pair = await this.tokens.issueTokens(user);
    return { ...pair, isNewUser: existing === null };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.refresh(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  async joinCohort(userId: string, rawCode: string): Promise<JoinCohortResult> {
    const normalized = rawCode.trim().toUpperCase();
    const joinCode = await this.prisma.joinCode.findUnique({
      where: { code: normalized },
      include: { cohort: { include: { school: true } } },
    });

    if (!joinCode || !joinCode.isActive || !joinCode.cohort.isActive) {
      throw new NotFoundException({
        code: 'INVALID_JOIN_CODE',
        message: 'Join code not found or inactive.',
      });
    }

    if (joinCode.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'JOIN_CODE_EXPIRED',
        message: 'This join code has expired.',
      });
    }

    if (
      joinCode.maxUses !== null &&
      joinCode.currentUses >= joinCode.maxUses
    ) {
      throw new BadRequestException({
        code: 'JOIN_CODE_EXHAUSTED',
        message: 'This join code has reached its maximum uses.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const nextUses = joinCode.currentUses + 1;
      const shouldDeactivate =
        joinCode.type === 'SINGLE_USE' ||
        (joinCode.maxUses !== null && nextUses >= joinCode.maxUses);

      await tx.joinCode.update({
        where: { id: joinCode.id },
        data: {
          currentUses: nextUses,
          ...(shouldDeactivate ? { isActive: false } : {}),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { cohortId: joinCode.cohortId },
      });
    });

    return {
      cohortId: joinCode.cohort.id,
      cohortName: joinCode.cohort.name,
      schoolId: joinCode.cohort.school.id,
      schoolName: joinCode.cohort.school.name,
    };
  }
}
