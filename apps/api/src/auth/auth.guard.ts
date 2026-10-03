import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthenticatedUser {
  id: string;
  role: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: unknown = request.headers?.authorization;
    const [type, token] =
      typeof header === 'string' ? header.split(' ') : [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set. Check apps/api/.env');
    }

    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token, {
        secret,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string') {
        throw new UnauthorizedException();
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = { id: user.id, role: user.role } satisfies AuthenticatedUser;
    return true;
  }
}
