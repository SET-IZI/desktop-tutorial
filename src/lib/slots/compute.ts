import { TZDate } from '@date-fns/tz';
import type { Closure, OpeningRange, RushMode } from '@/lib/storefront/types';

/**
 * Créneaux de retrait/livraison calculés depuis la charge réelle de la cuisine.
 * Fonction pure : l'heure courante, la config et la charge sont passées en entrée.
 *
 * Règles :
 *  - un créneau commence toutes les `slotIntervalMinutes` à partir de l'ouverture,
 *    le dernier démarre avant la fermeture ;
 *  - premier créneau possible = maintenant + préparation (+ rush) + délai de service ;
 *  - capacité = surcharge ponctuelle (time_slots) sinon capacité de l'établissement ;
 *  - mode rush "paused" : aucune commande possible.
 */

export type SlotStatus = 'available' | 'full' | 'blocked';

export interface Slot {
  /** Début du créneau, ISO UTC : valeur envoyée à la commande (orders.scheduled_for). */
  startsAt: string;
  /** "HH:MM" dans le fuseau de l'établissement. */
  time: string;
  status: SlotStatus;
  remaining: number;
}

export interface SlotDay {
  /** YYYY-MM-DD dans le fuseau de l'établissement. */
  date: string;
  /** 0 = aujourd'hui, 1 = demain… */
  offset: number;
  slots: Slot[];
}

export interface SlotConfig {
  timezone: string;
  prepTimeMinutes: number;
  slotIntervalMinutes: number;
  slotCapacity: number;
  rushMode: RushMode;
  rushExtraMinutes: number;
  /** Plages du service concerné uniquement. */
  hours: Pick<OpeningRange, 'weekday' | 'opensAt' | 'closesAt'>[];
  closures: Closure[];
}

export interface SlotOverride {
  startsAt: string;
  capacity: number | null;
  isBlocked: boolean;
}

export interface SlotLoad {
  startsAt: string;
  count: number;
}

export interface ComputeSlotsInput {
  now: Date;
  config: SlotConfig;
  overrides?: SlotOverride[];
  load?: SlotLoad[];
  /** Nombre de jours proposés, aujourd'hui compris. */
  days?: number;
  /** Délai additionnel (ex. temps de trajet en livraison). */
  leadMinutes?: number;
}

export interface SlotsResult {
  paused: boolean;
  days: SlotDay[];
  firstAvailable: Slot | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseTime(value: string): [number, number] {
  const [h, m] = value.split(':').map(Number);
  return [h ?? 0, m ?? 0];
}

function isoDate(d: TZDate): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isClosed(date: string, closures: Closure[]): boolean {
  return closures.some((c) => date >= c.startsOn && date <= c.endsOn);
}

export function computeSlots({
  now,
  config,
  overrides = [],
  load = [],
  days = 3,
  leadMinutes = 0,
}: ComputeSlotsInput): SlotsResult {
  if (config.rushMode === 'paused') return { paused: true, days: [], firstAvailable: null };

  const tz = config.timezone;
  const interval = Math.max(5, config.slotIntervalMinutes) * 60_000;
  const rush = config.rushMode === 'extended' ? config.rushExtraMinutes : 0;
  const earliest = now.getTime() + (config.prepTimeMinutes + rush + leadMinutes) * 60_000;

  const loadByStart = new Map(load.map((l) => [new Date(l.startsAt).getTime(), l.count]));
  const overrideByStart = new Map(overrides.map((o) => [new Date(o.startsAt).getTime(), o]));

  const today = new TZDate(now.getTime(), tz);
  const result: SlotDay[] = [];

  for (let offset = 0; offset < days; offset++) {
    const day = new TZDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      12,
      0,
      tz,
    );
    const date = isoDate(day);
    if (isClosed(date, config.closures)) continue;

    const isoWeekday = day.getDay() === 0 ? 7 : day.getDay();
    const ranges = config.hours
      .filter((h) => h.weekday === isoWeekday)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt));

    const slots: Slot[] = [];
    const seen = new Set<number>();
    for (const range of ranges) {
      const [oh, om] = parseTime(range.opensAt);
      const [ch, cm] = parseTime(range.closesAt);
      const opens = new TZDate(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        oh,
        om,
        tz,
      ).getTime();
      const closes = new TZDate(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        ch,
        cm,
        tz,
      ).getTime();

      for (let t = opens; t < closes; t += interval) {
        if (t < earliest || seen.has(t)) continue;
        seen.add(t);
        const override = overrideByStart.get(t);
        const capacity = override?.capacity ?? config.slotCapacity;
        const remaining = Math.max(0, capacity - (loadByStart.get(t) ?? 0));
        const local = new TZDate(t, tz);
        slots.push({
          startsAt: new Date(t).toISOString(),
          time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
          status: override?.isBlocked ? 'blocked' : remaining === 0 ? 'full' : 'available',
          remaining: override?.isBlocked ? 0 : remaining,
        });
      }
    }
    if (slots.length > 0) result.push({ date, offset, slots });
  }

  const firstAvailable =
    result.flatMap((d) => d.slots).find((s) => s.status === 'available') ?? null;
  return { paused: false, days: result, firstAvailable };
}

/** Le service est-il ouvert à l'instant `now` ? (pour la pastille Ouvert/Fermé) */
export function isOpenAt(
  now: Date,
  config: Pick<SlotConfig, 'timezone' | 'hours' | 'closures'>,
): boolean {
  const local = new TZDate(now.getTime(), config.timezone);
  if (isClosed(isoDate(local), config.closures)) return false;
  const weekday = local.getDay() === 0 ? 7 : local.getDay();
  const minutes = local.getHours() * 60 + local.getMinutes();
  return config.hours.some((h) => {
    if (h.weekday !== weekday) return false;
    const [oh, om] = parseTime(h.opensAt);
    const [ch, cm] = parseTime(h.closesAt);
    return minutes >= oh * 60 + om && minutes < ch * 60 + cm;
  });
}
