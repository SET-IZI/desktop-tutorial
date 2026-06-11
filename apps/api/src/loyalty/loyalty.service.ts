import { Injectable } from '@nestjs/common';
import { LoyaltyReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// PRD §11 — 1 € dépensé = 1 point
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  earn(userId: string, points: number, reason: LoyaltyReason) {
    if (points <= 0) return Promise.resolve(null);
    return this.prisma.loyaltyTransaction.create({ data: { userId, points, reason } });
  }

  async balance(userId: string) {
    const result = await this.prisma.loyaltyTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return { points: result._sum.points ?? 0 };
  }
}
