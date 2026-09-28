import { computeSlots, isOpenAt, type SlotConfig } from '@/lib/slots/compute';

// Mardi 6 octobre 2026, Paris (UTC+2 en heure d'été)
const at = (iso: string) => new Date(iso);

const config: SlotConfig = {
  timezone: 'Europe/Paris',
  prepTimeMinutes: 15,
  slotIntervalMinutes: 15,
  slotCapacity: 2,
  rushMode: 'off',
  rushExtraMinutes: 20,
  hours: [
    { weekday: 2, opensAt: '11:30:00', closesAt: '14:30:00' },
    { weekday: 2, opensAt: '18:30:00', closesAt: '22:30:00' },
    { weekday: 3, opensAt: '11:30:00', closesAt: '14:30:00' },
  ],
  closures: [],
};

describe('créneaux', () => {
  it('démarre après le temps de préparation, en heure locale', () => {
    const { days, firstAvailable } = computeSlots({ now: at('2026-10-06T10:00:00Z'), config }); // 12:00 à Paris
    expect(days[0]!.date).toBe('2026-10-06');
    expect(days[0]!.slots[0]!.time).toBe('12:15');
    expect(firstAvailable?.startsAt).toBe('2026-10-06T10:15:00.000Z');
    // dernier créneau du midi à 14:15, puis le soir
    const times = days[0]!.slots.map((s) => s.time);
    expect(times).toContain('14:15');
    expect(times).not.toContain('14:30');
    expect(times).toContain('18:30');
  });

  it('propose les jours suivants ouverts et saute les jours fermés', () => {
    const { days } = computeSlots({ now: at('2026-10-06T10:00:00Z'), config, days: 8 });
    expect(days.map((d) => d.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-13']);
    expect(days[1]!.offset).toBe(1);
  });

  it('grise les créneaux complets et bloqués', () => {
    const { days, firstAvailable } = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config,
      load: [
        { startsAt: '2026-10-06T10:15:00Z', count: 2 },
        { startsAt: '2026-10-06T10:30:00+00:00', count: 1 },
      ],
      overrides: [{ startsAt: '2026-10-06T10:45:00Z', capacity: null, isBlocked: true }],
    });
    const [s1, s2, s3] = days[0]!.slots;
    expect(s1).toMatchObject({ time: '12:15', status: 'full', remaining: 0 });
    expect(s2).toMatchObject({ time: '12:30', status: 'available', remaining: 1 });
    expect(s3).toMatchObject({ time: '12:45', status: 'blocked' });
    expect(firstAvailable?.time).toBe('12:30');
  });

  it('applique une capacité surchargée', () => {
    const { days } = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config,
      overrides: [{ startsAt: '2026-10-06T10:15:00Z', capacity: 10, isBlocked: false }],
      load: [{ startsAt: '2026-10-06T10:15:00Z', count: 3 }],
    });
    expect(days[0]!.slots[0]).toMatchObject({ status: 'available', remaining: 7 });
  });

  it('mode rush : allonge le délai ou met en pause', () => {
    const extended = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config: { ...config, rushMode: 'extended' },
    });
    expect(extended.firstAvailable?.time).toBe('12:45'); // 15 + 20 min → 12:35 → créneau 12:45
    const paused = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config: { ...config, rushMode: 'paused' },
    });
    expect(paused).toEqual({ paused: true, days: [], firstAvailable: null });
  });

  it('ajoute le délai de livraison', () => {
    const { firstAvailable } = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config,
      leadMinutes: 30,
    });
    expect(firstAvailable?.time).toBe('12:45');
  });

  it('respecte les fermetures exceptionnelles', () => {
    const { days } = computeSlots({
      now: at('2026-10-06T10:00:00Z'),
      config: { ...config, closures: [{ startsOn: '2026-10-06', endsOn: '2026-10-06' }] },
    });
    expect(days.map((d) => d.date)).toEqual(['2026-10-07']);
  });

  it('gère le passage à l’heure d’hiver (25 octobre 2026)', () => {
    const sunday = { ...config, hours: [{ weekday: 7, opensAt: '12:00', closesAt: '13:00' }] };
    const { days } = computeSlots({ now: at('2026-10-25T06:00:00Z'), config: sunday, days: 1 });
    // 12:00 à Paris = 11:00 UTC après le changement d'heure
    expect(days[0]!.slots[0]!.startsAt).toBe('2026-10-25T11:00:00.000Z');
  });

  it('indique si c’est ouvert maintenant', () => {
    expect(isOpenAt(at('2026-10-06T10:00:00Z'), config)).toBe(true); // mardi 12:00
    expect(isOpenAt(at('2026-10-06T13:00:00Z'), config)).toBe(false); // mardi 15:00
    expect(isOpenAt(at('2026-10-05T10:00:00Z'), config)).toBe(false); // lundi
  });
});
