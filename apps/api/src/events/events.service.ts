import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventRegistrationStatus,
  EventType,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

function parseEventType(raw?: string): EventType | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (
    upper === EventType.TOURNAMENT ||
    upper === EventType.CLEANUP ||
    upper === EventType.WORKSHOP
  ) {
    return upper;
  }
  throw new BadRequestException(
    'type must be tournament, cleanup, or workshop.',
  );
}

@Injectable()
export class EventsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForStudent(userId: string, rawType?: string) {
    const type = parseEventType(rawType);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { cohort: { select: { id: true, schoolId: true } } },
    });

    const cohortId = user?.cohort?.id ?? null;
    const schoolId = user?.cohort?.schoolId ?? null;

    const [events, registrations] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          isActive: true,
          ...(type ? { type } : {}),
          OR: [
            { targetAll: true },
            ...(cohortId
              ? [{ targets: { some: { cohortId } } }]
              : []),
            ...(schoolId
              ? [{ targets: { some: { schoolId } } }]
              : []),
          ],
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.eventRegistration.findMany({
        where: { userId, status: EventRegistrationStatus.REGISTERED },
        select: { eventId: true },
      }),
    ]);

    const regSet = new Set(registrations.map((r) => r.eventId));
    return events.map((ev) => ({
      ...ev,
      registered: regSet.has(ev.id),
    }));
  }

  async getOne(userId: string, eventId: string) {
    const [event, reg] = await Promise.all([
      this.prisma.event.findFirst({ where: { id: eventId, isActive: true } }),
      this.prisma.eventRegistration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      }),
    ]);
    if (!event) {
      throw new NotFoundException('Event not found.');
    }
    return {
      ...event,
      registered: reg?.status === EventRegistrationStatus.REGISTERED,
    };
  }

  async register(userId: string, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, isActive: true },
      });
      if (!event) {
        throw new NotFoundException('Event not found.');
      }

      const existing = await tx.eventRegistration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (existing?.status === EventRegistrationStatus.REGISTERED) {
        throw new ConflictException({
          code: 'ALREADY_REGISTERED',
          message: 'You are already registered for this event.',
        });
      }

      if (
        event.maxCapacity !== null &&
        event.currentRegistrations >= event.maxCapacity
      ) {
        throw new ConflictException({
          code: 'EVENT_FULL',
          message: 'This event has reached capacity.',
        });
      }

      const registration = await tx.eventRegistration.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: {
          userId,
          eventId,
          status: EventRegistrationStatus.REGISTERED,
        },
        update: {
          status: EventRegistrationStatus.REGISTERED,
        },
      });

      await tx.event.update({
        where: { id: eventId },
        data: { currentRegistrations: { increment: 1 } },
      });

      return registration;
    });
  }

  async cancelRegistration(userId: string, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.eventRegistration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (!existing || existing.status !== EventRegistrationStatus.REGISTERED) {
        throw new NotFoundException('Active registration not found.');
      }

      const updated = await tx.eventRegistration.update({
        where: { id: existing.id },
        data: { status: EventRegistrationStatus.CANCELLED },
      });

      await tx.event.update({
        where: { id: eventId },
        data: { currentRegistrations: { decrement: 1 } },
      });

      return updated;
    });
  }

  async create(
    createdById: string,
    input: {
      title?: unknown;
      description?: unknown;
      type?: unknown;
      date?: unknown;
      venue?: unknown;
      maxCapacity?: unknown;
      schoolIds?: unknown;
      cohortIds?: unknown;
    },
  ) {
    const title =
      typeof input.title === 'string' ? input.title.trim() : '';
    const venue =
      typeof input.venue === 'string' ? input.venue.trim() : '';
    const type = parseEventType(
      typeof input.type === 'string' ? input.type : undefined,
    );
    const date =
      typeof input.date === 'string' ? new Date(input.date) : null;

    if (!title || !venue || !type || !date || Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'title, type, date (ISO), and venue are required.',
      );
    }

    let maxCapacity: number | null = null;
    if (input.maxCapacity !== undefined && input.maxCapacity !== null) {
      const parsed = Number(input.maxCapacity);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException(
          'maxCapacity must be a positive integer.',
        );
      }
      maxCapacity = parsed;
    }

    const schoolIds = Array.isArray(input.schoolIds)
      ? input.schoolIds.filter((s): s is string => typeof s === 'string')
      : [];
    const cohortIds = Array.isArray(input.cohortIds)
      ? input.cohortIds.filter((c): c is string => typeof c === 'string')
      : [];
    const targetAll = schoolIds.length === 0 && cohortIds.length === 0;

    return this.prisma.event.create({
      data: {
        title,
        description:
          typeof input.description === 'string' ? input.description.trim() : null,
        type,
        date,
        venue,
        maxCapacity,
        targetAll,
        createdById,
        targets: targetAll
          ? undefined
          : {
              create: [
                ...schoolIds.map((schoolId) => ({ schoolId })),
                ...cohortIds.map((cohortId) => ({ cohortId })),
              ],
            },
      },
      include: { targets: true },
    });
  }

  async update(
    eventId: string,
    input: {
      title?: unknown;
      description?: unknown;
      date?: unknown;
      venue?: unknown;
      maxCapacity?: unknown;
      isActive?: unknown;
    },
  ) {
    const existing = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!existing) {
      throw new NotFoundException('Event not found.');
    }

    const data: Record<string, unknown> = {};
    if (typeof input.title === 'string' && input.title.trim()) {
      data.title = input.title.trim();
    }
    if (typeof input.description === 'string') {
      data.description = input.description.trim();
    }
    if (typeof input.venue === 'string' && input.venue.trim()) {
      data.venue = input.venue.trim();
    }
    if (typeof input.date === 'string') {
      const parsed = new Date(input.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid date.');
      }
      data.date = parsed;
    }
    if (input.maxCapacity !== undefined) {
      if (input.maxCapacity === null) {
        data.maxCapacity = null;
      } else {
        const parsed = Number(input.maxCapacity);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new BadRequestException('Invalid maxCapacity.');
        }
        data.maxCapacity = parsed;
      }
    }
    if (typeof input.isActive === 'boolean') {
      data.isActive = input.isActive;
    }

    return this.prisma.event.update({ where: { id: eventId }, data });
  }
}
