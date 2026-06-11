import { Injectable, NotFoundException } from '@nestjs/common';
import { DelayStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DELAY_LABELS: Record<DelayStatus, string> = {
  ON_TIME: '🟢 À l’heure',
  DELAY_5: '🟠 5 min de retard',
  DELAY_10: '🟠 10 min de retard',
  DELAY_15: '🔴 15 min de retard',
  DELAY_15_PLUS: '🔴 Plus de 15 min de retard',
  ABSENT: '⚫ Absent',
};

@Injectable()
export class BarbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.barberProfile.findMany({
      where: { active: true },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
  }

  async profile(id: string) {
    const barber = await this.prisma.barberProfile.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        galleryPhotos: true,
        reviews: { where: { published: true }, take: 20, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!barber) throw new NotFoundException('Barber introuvable');
    return barber;
  }

  // PRD §2 — nombre de clients, prestations, note moyenne, taux de ponctualité
  async stats(id: string) {
    const [completed, distinctClients, rating] = await Promise.all([
      this.prisma.appointment.count({ where: { barberId: id, status: 'COMPLETED' } }),
      this.prisma.appointment.findMany({
        where: { barberId: id, status: 'COMPLETED' },
        distinct: ['clientId'],
        select: { clientId: true },
      }),
      this.prisma.review.aggregate({
        where: { barberId: id, published: true },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    const onTime = await this.prisma.appointment.count({
      where: { barberId: id, status: 'COMPLETED', barber: { delayStatus: 'ON_TIME' } },
    });
    return {
      totalAppointments: completed,
      totalClients: distinctClients.length,
      averageRating: rating._avg.rating,
      reviewCount: rating._count,
      punctualityRate: completed > 0 ? Math.round((onTime / completed) * 100) : null,
    };
  }

  async updateDelayStatus(id: string, status: DelayStatus) {
    const barber = await this.prisma.barberProfile.update({
      where: { id },
      data: { delayStatus: status, delayUpdatedAt: new Date() },
      include: { user: { select: { firstName: true } } },
    });

    // Notifie tous les clients ayant un RDV confirmé avec ce barber aujourd'hui
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const upcoming = await this.prisma.appointment.findMany({
      where: {
        barberId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { gte: new Date(), lte: endOfDay },
      },
      select: { clientId: true },
    });
    await this.notifications.sendToUsers(
      upcoming.map((a) => a.clientId),
      {
        title: `${barber.user.firstName} — mise à jour`,
        body: DELAY_LABELS[status],
      },
    );

    return barber;
  }
}
