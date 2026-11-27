import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashToken } from './hash.js';

const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class TokensService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set. Check apps/api/.env');
    }
    return secret;
  }

  async issueTokens(user: { id: string; role: string }): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.jwtSecret(),
        algorithm: 'HS256',
        expiresIn: ACCESS_TTL_SECONDS,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken, expiresInSeconds: ACCESS_TTL_SECONDS };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const invalid = (): UnauthorizedException =>
      new UnauthorizedException('Invalid or expired refresh token.');

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (
      !record ||
      record.revokedAt !== null ||
      record.expiresAt.getTime() < Date.now() ||
      record.user.deletedAt !== null
    ) {
      throw invalid();
    }

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw invalid();
    }

    return this.issueTokens(record.user);
  }

  async revokeToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
