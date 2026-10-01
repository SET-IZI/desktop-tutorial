'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SlotsResult } from '@/lib/slots/compute';
import type { Fulfillment } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

interface SlotPickerProps {
  slug: string;
  /** Établissement dont on affiche les créneaux. */
  locationId: string;
  timezone: string;
  service: Fulfillment;
  value: string | null;
  onChange: (slot: string | null) => void;
}

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: SlotsResult };

export function SlotPicker({
  slug,
  locationId,
  timezone,
  service,
  value,
  onChange,
}: SlotPickerProps) {
  const t = useTranslations('shop');
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [dayIndex, setDayIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch(
        `/api/storefront/${slug}/slots?service=${service}&location=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(String(res.status));
      setState({ status: 'ready', data: (await res.json()) as SlotsResult });
    } catch {
      setState({ status: 'error' });
    }
  }, [slug, service, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Créneau mémorisé plus disponible → on propose le premier libre (et on le dit).
  useEffect(() => {
    if (state.status !== 'ready') return;
    const all = state.data.days.flatMap((d) => d.slots);
    const current = all.find((s) => s.startsAt === value);
    if (current?.status === 'available') {
      setDayIndex(
        Math.max(
          0,
          state.data.days.findIndex((d) => d.slots.includes(current)),
        ),
      );
      return;
    }
    const first = state.data.firstAvailable;
    onChange(first?.startsAt ?? null);
    if (value && first) setNotice(t('slotChanged', { time: first.time }));
    setDayIndex(
      Math.max(
        0,
        state.data.days.findIndex((d) => d.slots.some((s) => s.startsAt === first?.startsAt)),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'arrivée des données
  }, [state]);

  const dayLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
    return (date: string, offset: number) =>
      offset === 0
        ? t('today')
        : offset === 1
          ? t('tomorrow')
          : fmt.format(new Date(`${date}T12:00:00Z`));
  }, [locale, timezone, t]);

  const title = service === 'pickup' ? t('slotTitlePickup') : t('slotTitleDelivery');

  if (state.status === 'loading') {
    return (
      <section aria-label={title} className="flex items-center gap-2 py-4 text-fg-muted" aria-busy>
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t('slotsLoading')}
      </section>
    );
  }
  if (state.status === 'error') {
    return (
      <section aria-label={title} className="space-y-3 py-2">
        <p>{t('slotsError')}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          {t('retry')}
        </Button>
      </section>
    );
  }

  const { data } = state;
  if (data.paused || data.days.length === 0) {
    return (
      <section aria-label={title} className="rounded-bento-sm bg-orange/10 p-4">
        <p className="font-medium">{data.paused ? t('paused') : t('slotsNone')}</p>
      </section>
    );
  }

  const day = data.days[Math.min(dayIndex, data.days.length - 1)]!;
  const first = data.firstAvailable;

  return (
    <section aria-labelledby="slot-title" className="space-y-3">
      <h3 id="slot-title" className="text-[20px] font-bold tracking-display">
        {title}
      </h3>
      {notice ? (
        <p role="status" className="rounded-2xl bg-orange/10 px-4 py-2 text-[15px]">
          {notice}
        </p>
      ) : null}

      {data.days.length > 1 ? (
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-pressed={i === dayIndex}
              onClick={() => setDayIndex(i)}
              className={cn(
                'min-h-touch shrink-0 rounded-full px-4 text-[15px] font-semibold capitalize transition-colors',
                i === dayIndex ? 'bg-fg text-bg' : 'bg-fg/[0.06] text-fg hover:bg-fg/10',
              )}
            >
              {dayLabel(d.date, d.offset)}
            </button>
          ))}
        </div>
      ) : null}

      <div role="radiogroup" aria-label={title} className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {day.slots.map((slot) => {
          const selected = slot.startsAt === value;
          const unavailable = slot.status !== 'available';
          const isFirst = first?.startsAt === slot.startsAt;
          return (
            <button
              key={slot.startsAt}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={unavailable || undefined}
              disabled={unavailable}
              onClick={() => {
                onChange(slot.startsAt);
                setNotice(null);
              }}
              aria-label={
                unavailable
                  ? `${slot.time}, ${slot.status === 'full' ? t('slotFull') : t('slotBlocked')}`
                  : isFirst
                    ? t('slotAsap', { time: slot.time })
                    : slot.time
              }
              className={cn(
                'min-h-touch rounded-2xl text-[15px] font-semibold tabular-nums transition-colors',
                selected && 'bg-cta text-cta-fg shadow-soft',
                !selected && !unavailable && 'bg-fg/[0.06] text-fg hover:bg-fg/10',
                unavailable &&
                  'cursor-not-allowed bg-fg/[0.03] text-fg-muted line-through decoration-fg/40',
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </section>
  );
}
