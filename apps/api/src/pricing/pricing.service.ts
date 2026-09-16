import { Injectable } from '@nestjs/common';
import { PricingRule, Service } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PriceQuote {
  priceCents: number;
  appliedRules: string[];
}

export interface PricingContext {
  /** Date et heure du rendez-vous */
  startsAt: Date;
  /** Moment où la réservation est effectuée (pour le tarif urgence) */
  bookedAt: Date;
  /** Le jour du RDV est-il férié ? */
  isHoliday: boolean;
  barberId?: string;
}

/**
 * Moteur de tarification dynamique (PRD §4).
 *
 * Ordre d'application :
 *  1. CUSTOM — prix personnalisé ciblant la prestation et/ou le barber : override absolu.
 *  2. NIGHT puis EVENING — prix fixe par plage horaire ; la plage la plus
 *     tardive gagne (après 22h prime sur après 20h).
 *  3. WEEKEND / HOLIDAY / URGENCY — majorations en %, cumulatives sur le prix retenu.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(service: Service, ctx: PricingContext): Promise<PriceQuote> {
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ serviceId: null }, { serviceId: service.id }] },
          { OR: [{ barberId: null }, { barberId: ctx.barberId ?? null }] },
        ],
      },
    });
    return this.computePrice(service.basePriceCents, rules, ctx);
  }

  computePrice(basePriceCents: number, rules: PricingRule[], ctx: PricingContext): PriceQuote {
    const applied: string[] = [];
    let price = basePriceCents;

    const custom = rules.find((r) => r.type === 'CUSTOM' && r.fixedPriceCents != null);
    if (custom) {
      return { priceCents: custom.fixedPriceCents!, appliedRules: [custom.label] };
    }

    const hour = ctx.startsAt.getHours();
    const timeRules = rules
      .filter(
        (r) =>
          (r.type === 'NIGHT' || r.type === 'EVENING') &&
          r.fixedPriceCents != null &&
          r.startHour != null &&
          hour >= r.startHour,
      )
      .sort((a, b) => b.startHour! - a.startHour!);
    if (timeRules.length > 0) {
      price = timeRules[0].fixedPriceCents!;
      applied.push(timeRules[0].label);
    }

    const day = ctx.startsAt.getDay();
    const isWeekend = day === 0 || day === 6;
    const minutesBefore = (ctx.startsAt.getTime() - ctx.bookedAt.getTime()) / 60_000;

    for (const rule of rules) {
      if (rule.surchargePercent == null) continue;
      const matches =
        (rule.type === 'WEEKEND' && isWeekend) ||
        (rule.type === 'HOLIDAY' && ctx.isHoliday) ||
        (rule.type === 'URGENCY' &&
          minutesBefore >= 0 &&
          minutesBefore < (rule.urgencyWindowMinutes ?? 120));
      if (matches) {
        price = Math.round(price * (1 + rule.surchargePercent / 100));
        applied.push(rule.label);
      }
    }

    return { priceCents: price, appliedRules: applied };
  }

  async isHoliday(date: Date): Promise<boolean> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const holiday = await this.prisma.holiday.findFirst({
      where: { date: { gte: dayStart, lte: dayEnd } },
    });
    return holiday != null;
  }
}
