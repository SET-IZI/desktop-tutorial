import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// PRD §10 — push notifications via Firebase Cloud Messaging :
// confirmation de réservation, rappels J-1 / 1h avant, barber en retard,
// nouvelle disponibilité, promotions.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUsers(userIds: string[], payload: PushPayload) {
    if (userIds.length === 0) return;
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
    });
    // TODO: brancher firebase-admin (messaging.sendEachForMulticast)
    // avec les credentials FIREBASE_* du .env
    this.logger.log(
      `Push "${payload.title}" → ${tokens.length} appareil(s) (${userIds.length} utilisateur(s))`,
    );
  }

  registerDevice(userId: string, token: string, platform: 'ios' | 'android') {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }
}
