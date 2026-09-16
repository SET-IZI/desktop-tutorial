import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const SLOT_STEP_MINUTES = 15;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // Disponibilités temps réel : heures d'ouverture − RDV existants − créneaux bloqués,
  // avec le prix dynamique calculé pour chaque créneau.
  async availability(date: Date, serviceId: string, barberId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Prestation introuvable');

    const barbers = await this.prisma.barberProfile.findMany({
      where: { active: true, ...(barberId ? { id: barberId } : {}) },
      include: {
        workingHours: { where: { weekday: date.getDay() } },
        appointments: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
            startsAt: { gte: startOfDay(date), lte: endOfDay(date) },
          },
        },
        blockedSlots: {
          where: { startsAt: { lte: endOfDay(date) }, endsAt: { gte: startOfDay(date) } },
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const isHoliday = await this.pricing.isHoliday(date);
    const now = new Date();
    const results: {
      barberId: string;
      barberName: string;
      startsAt: Date;
      endsAt: Date;
      priceCents: number;
      appliedRules: string[];
    }[] = [];

    for (const barber of barbers) {
      for (const hours of barber.workingHours) {
        for (
          let slot = atTime(date, hours.startTime);
          slot.getTime() + service.durationMinutes * 60_000 <= atTime(date, hours.endTime).getTime();
          slot = new Date(slot.getTime() + SLOT_STEP_MINUTES * 60_000)
        ) {
          const slotEnd = new Date(slot.getTime() + service.durationMinutes * 60_000);
          if (slot < now) continue;
          const busy =
            barber.appointments.some((a) => overlaps(slot, slotEnd, a.startsAt, a.endsAt)) ||
            barber.blockedSlots.some((b) => overlaps(slot, slotEnd, b.startsAt, b.endsAt));
          if (busy) continue;

          const quote = await this.pricing.quote(service, {
            startsAt: slot,
            bookedAt: now,
            isHoliday,
            barberId: barber.id,
          });
          results.push({
            barberId: barber.id,
            barberName: `${barber.user.firstName} ${barber.user.lastName}`,
            startsAt: slot,
            endsAt: slotEnd,
            priceCents: quote.priceCents,
            appliedRules: quote.appliedRules,
          });
        }
      }
    }
    return results.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async create(clientId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const services = await this.prisma.service.findMany({ where: { id: { in: dto.serviceIds } } });
    if (services.length === 0) throw new BadRequestException('Aucune prestation sélectionnée');

    const durationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const conflict = await this.prisma.appointment.findFirst({
      where: {
        barberId: dto.barberId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (conflict) throw new ConflictException('Ce créneau vient d’être réservé');

    const now = new Date();
    const isHoliday = await this.pricing.isHoliday(startsAt);
    const quotes = await Promise.all(
      services.map((s) =>
        this.pricing.quote(s, { startsAt, bookedAt: now, isHoliday, barberId: dto.barberId }),
      ),
    );
    const totalPriceCents = quotes.reduce((sum, q) => sum + q.priceCents, 0);

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId,
        barberId: dto.barberId,
        startsAt,
        endsAt,
        totalPriceCents,
        appliedRuleLabels: [...new Set(quotes.flatMap((q) => q.appliedRules))],
        services: {
          create: services.map((s, i) => ({ serviceId: s.id, priceCents: quotes[i].priceCents })),
        },
      },
      include: { services: { include: { service: true } } },
    });

    await this.notifications.sendToUsers([clientId], {
      title: 'Réservation confirmée ✂️',
      body: `Rendez-vous le ${startsAt.toLocaleString('fr-FR')} — ${(totalPriceCents / 100).toFixed(2)} €`,
    });

    return appointment;
  }

  history(clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId, status: 'COMPLETED' },
      orderBy: { startsAt: 'desc' },
      include: {
        services: { include: { service: true } },
        photos: true,
        barber: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async addPhotos(appointmentId: string, photos: { url: string; label?: string }[]) {
    const existing = await this.prisma.appointmentPhoto.count({ where: { appointmentId } });
    if (existing + photos.length > 10) {
      throw new BadRequestException('Maximum 10 photos par prestation');
    }
    await this.prisma.appointmentPhoto.createMany({
      data: photos.map((p) => ({ appointmentId, url: p.url, label: p.label })),
    });

    // Fin de prestation : la prestation est complétée et les points
    // de fidélité sont crédités (1 € dépensé = 1 point, PRD §11)
    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });
    await this.loyalty.earn(
      appointment.clientId,
      Math.floor(appointment.totalPriceCents / 100),
      'EARN_APPOINTMENT',
    );
    return this.prisma.appointmentPhoto.findMany({ where: { appointmentId } });
  }
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function atTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const r = new Date(date);
  r.setHours(h, m, 0, 0);
  return r;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
