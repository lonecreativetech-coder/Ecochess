import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  @Get('db')
  async checkDb(): Promise<{ status: string; schools: number }> {
    const schools = await this.prisma.school.count();
    return { status: 'ok', schools };
  }
}
