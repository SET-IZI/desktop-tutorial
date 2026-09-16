import { PricingRule } from '@prisma/client';
import { PricingService, PricingContext } from './pricing.service';

const rule = (partial: Partial<PricingRule>): PricingRule =>
  ({
    id: 'r',
    type: 'EVENING',
    label: 'règle',
    active: true,
    serviceId: null,
    barberId: null,
    fixedPriceCents: null,
    startHour: null,
    surchargePercent: null,
    urgencyWindowMinutes: null,
    ...partial,
  }) as PricingRule;

const ctx = (overrides: Partial<PricingContext> = {}): PricingContext => ({
  // Mercredi 14h, réservé 3 jours avant
  startsAt: new Date('2026-04-15T14:00:00'),
  bookedAt: new Date('2026-04-12T14:00:00'),
  isHoliday: false,
  ...overrides,
});

describe('PricingService.computePrice', () => {
  const service = new PricingService(null as never);

  const evening = rule({ type: 'EVENING', label: 'Tarif soirée', startHour: 20, fixedPriceCents: 3500 });
  const night = rule({ type: 'NIGHT', label: 'Tarif nuit', startHour: 22, fixedPriceCents: 5000 });

  it('applique le tarif normal en journée (coupe 25 €)', () => {
    const quote = service.computePrice(2500, [evening, night], ctx());
    expect(quote.priceCents).toBe(2500);
    expect(quote.appliedRules).toEqual([]);
  });

  it('applique le tarif soirée après 20h (35 €)', () => {
    const quote = service.computePrice(2500, [evening, night], ctx({ startsAt: new Date('2026-04-15T20:30:00') }));
    expect(quote.priceCents).toBe(3500);
    expect(quote.appliedRules).toEqual(['Tarif soirée']);
  });

  it('applique le tarif nuit après 22h (50 €), prioritaire sur la soirée', () => {
    const quote = service.computePrice(2500, [evening, night], ctx({ startsAt: new Date('2026-04-15T22:15:00') }));
    expect(quote.priceCents).toBe(5000);
    expect(quote.appliedRules).toEqual(['Tarif nuit']);
  });

  it('majore le week-end en pourcentage', () => {
    const weekend = rule({ type: 'WEEKEND', label: 'Week-end +20 %', surchargePercent: 20 });
    const quote = service.computePrice(2500, [weekend], ctx({ startsAt: new Date('2026-04-18T14:00:00') })); // samedi
    expect(quote.priceCents).toBe(3000);
  });

  it('majore les jours fériés', () => {
    const holiday = rule({ type: 'HOLIDAY', label: 'Férié +30 %', surchargePercent: 30 });
    const quote = service.computePrice(2500, [holiday], ctx({ isHoliday: true }));
    expect(quote.priceCents).toBe(3250);
  });

  it('majore les réservations urgentes (moins de 2h avant)', () => {
    const urgency = rule({ type: 'URGENCY', label: 'Urgence +25 %', surchargePercent: 25, urgencyWindowMinutes: 120 });
    const quote = service.computePrice(
      2500,
      [urgency],
      ctx({ startsAt: new Date('2026-04-15T15:00:00'), bookedAt: new Date('2026-04-15T14:00:00') }),
    );
    expect(quote.priceCents).toBe(3125);
  });

  it('cumule majoration % sur un prix fixe horaire', () => {
    const weekend = rule({ type: 'WEEKEND', label: 'Week-end +20 %', surchargePercent: 20 });
    // Samedi 21h : soirée (35 €) puis +20 % = 42 €
    const quote = service.computePrice(2500, [evening, night, weekend], ctx({ startsAt: new Date('2026-04-18T21:00:00') }));
    expect(quote.priceCents).toBe(4200);
    expect(quote.appliedRules).toEqual(['Tarif soirée', 'Week-end +20 %']);
  });

  it('le prix personnalisé est un override absolu', () => {
    const custom = rule({ type: 'CUSTOM', label: 'Prix VIP', fixedPriceCents: 1500 });
    const quote = service.computePrice(2500, [custom, evening, night], ctx({ startsAt: new Date('2026-04-15T22:30:00') }));
    expect(quote.priceCents).toBe(1500);
    expect(quote.appliedRules).toEqual(['Prix VIP']);
  });
});
