/** Horaires hebdomadaires : représentation et validation (partagées front/serveur). */

export interface TimeRange {
  opensAt: string; // HH:MM
  closesAt: string;
}

/** Jours ISO 1 (lundi) … 7 (dimanche). */
export type WeekSchedule = Record<number, TimeRange[]>;

export type ScheduleError = {
  weekday: number;
  code: 'range_order' | 'overlap' | 'too_many' | 'format';
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const MAX_RANGES_PER_DAY = 4;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function emptySchedule(): WeekSchedule {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, []]));
}

/** Depuis les lignes opening_hours (format Postgres "HH:MM:SS"). */
export function scheduleFromRows(
  rows: { weekday: number; opens_at: string; closes_at: string }[],
): WeekSchedule {
  const schedule = emptySchedule();
  for (const r of rows) {
    schedule[r.weekday]?.push({
      opensAt: r.opens_at.slice(0, 5),
      closesAt: r.closes_at.slice(0, 5),
    });
  }
  for (const d of WEEKDAYS) schedule[d]!.sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  return schedule;
}

export function validateSchedule(schedule: WeekSchedule): ScheduleError[] {
  const errors: ScheduleError[] = [];
  for (const weekday of WEEKDAYS) {
    const ranges = schedule[weekday] ?? [];
    if (ranges.length > MAX_RANGES_PER_DAY) {
      errors.push({ weekday, code: 'too_many' });
      continue;
    }
    if (ranges.some((r) => !HHMM.test(r.opensAt) || !HHMM.test(r.closesAt))) {
      errors.push({ weekday, code: 'format' });
      continue;
    }
    if (ranges.some((r) => minutes(r.closesAt) <= minutes(r.opensAt))) {
      errors.push({ weekday, code: 'range_order' });
      continue;
    }
    const sorted = [...ranges].sort((a, b) => minutes(a.opensAt) - minutes(b.opensAt));
    if (sorted.some((r, i) => i > 0 && minutes(r.opensAt) < minutes(sorted[i - 1]!.closesAt))) {
      errors.push({ weekday, code: 'overlap' });
    }
  }
  return errors;
}
