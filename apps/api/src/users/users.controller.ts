import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankFor } from './ladder.js';

type Envelope<T> = { data: T; error: null; meta: null };

interface MeResponse {
  id: string;
  name: string | null;
  phone: string;
  ageBand: string | null;
  role: string;
  cohortId: string | null;
  lifetimeGreenPoints: number;
  greenPointBalance: number;
  rank: { tier: number; name: string };
}

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('me')
  async me(
    @Req() req: { user: AuthenticatedUser },
  ): Promise<Envelope<MeResponse>> {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      throw new NotFoundException();
    }
    return {
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        ageBand: user.ageBand,
        role: user.role,
        cohortId: user.cohortId,
        lifetimeGreenPoints: user.lifetimeGreenPoints,
        greenPointBalance: user.greenPointBalance,
        rank: rankFor(user.lifetimeGreenPoints),
      },
      error: null,
      meta: null,
    };
  }
}
