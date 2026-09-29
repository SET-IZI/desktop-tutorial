'use client';

import { CalendarOff, Copy, Plus, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { addClosure, deleteClosure, saveHours } from '@/app/app/(shell)/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { validateSchedule, WEEKDAYS, type WeekSchedule } from '@/lib/admin/schedule';
import { cn } from '@/lib/utils';

interface HoursEditorProps {
  schedules: { pickup: WeekSchedule; delivery: WeekSchedule };
  closures: { id: string; startsOn: string; endsOn: string; reason: string | null }[];
  canManage: boolean;
  deliveryEnabled: boolean;
  /** Onboarding : action après un enregistrement réussi, libellé du bouton, sans fermetures. */
  onSaved?: () => Promise<void>;
  saveLabel?: string;
  showClosures?: boolean;
}

const DEFAULT_RANGE = { opensAt: '11:30', closesAt: '14:30' };
const input =
  'h-11 rounded-xl bg-fg/[0.06] px-3 text-body tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-blue/50 disabled:opacity-60';

export function HoursEditor({
  schedules,
  closures,
  canManage,
  deliveryEnabled,
  onSaved,
  saveLabel,
  showClosures = true,
}: HoursEditorProps) {
  const t = useTranslations('admin.hours');
  const ta = useTranslations('admin');
  const locale = useLocale();
  const toast = useToast();
  const [service, setService] = useState<'pickup' | 'delivery'>('pickup');
  const [drafts, setDrafts] = useState(schedules);
  const [pending, start] = useTransition();
  const schedule = drafts[service];
  const errors = validateSchedule(schedule);
  const errorFor = (weekday: number) => errors.find((e) => e.weekday === weekday);

  const update = (weekday: number, fn: (ranges: WeekSchedule[number]) => WeekSchedule[number]) =>
    setDrafts((d) => ({
      ...d,
      [service]: { ...d[service], [weekday]: fn(d[service][weekday] ?? []) },
    }));

  const save = () =>
    start(async () => {
      const result = await saveHours({ service, schedule });
      if (result.ok) {
        if (onSaved) await onSaved();
        else toast(ta('saved'));
      } else toast(result.error === 'forbidden' ? ta('forbidden') : ta('saveError'), 'error');
    });

  const errorMessage = (weekday: number) => {
    const e = errorFor(weekday);
    if (!e) return null;
    if (e.code === 'overlap') return t('errors.overlap', { day: t(`days.${weekday}`) });
    if (e.code === 'too_many') return t('errors.too_many');
    return t('errors.range_order');
  };

  return (
    <div className="space-y-6">
      {deliveryEnabled ? (
        <Segmented
          label={t('title')}
          value={service}
          onChange={setService}
          options={[
            { value: 'pickup', label: t('pickup') },
            { value: 'delivery', label: t('delivery') },
          ]}
          className="max-w-sm"
        />
      ) : null}

      <Card className="divide-y divide-line/[0.06] p-2 sm:p-3">
        {WEEKDAYS.map((weekday) => {
          const ranges = schedule[weekday] ?? [];
          const open = ranges.length > 0;
          const message = errorMessage(weekday);
          return (
            <div key={weekday} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-start">
              <div className="flex items-center justify-between gap-3 sm:w-48 sm:shrink-0">
                <span className="font-semibold">{t(`days.${weekday}`)}</span>
                <span className="flex items-center gap-1">
                  <span className="text-[14px] text-fg-muted">
                    {open ? t('open') : t('closed')}
                  </span>
                  <Switch
                    label={`${t(`days.${weekday}`)} : ${open ? t('open') : t('closed')}`}
                    checked={open}
                    disabled={!canManage}
                    onChange={(v) => update(weekday, () => (v ? [DEFAULT_RANGE] : []))}
                  />
                </span>
              </div>
              {open ? (
                <div className="flex-1 space-y-2">
                  {ranges.map((range, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2.75rem] items-center gap-2 sm:max-w-md"
                    >
                      <label className="sr-only" htmlFor={`o-${weekday}-${i}`}>
                        {t('from')}
                      </label>
                      <input
                        id={`o-${weekday}-${i}`}
                        type="time"
                        step={300}
                        value={range.opensAt}
                        disabled={!canManage}
                        onChange={(e) =>
                          update(weekday, (rs) =>
                            rs.map((r, j) => (j === i ? { ...r, opensAt: e.target.value } : r)),
                          )
                        }
                        className={cn(input, 'w-full min-w-0', message && 'ring-2 ring-red/50')}
                      />
                      <span className="text-fg-muted">{t('to')}</span>
                      <label className="sr-only" htmlFor={`c-${weekday}-${i}`}>
                        {t('to')}
                      </label>
                      <input
                        id={`c-${weekday}-${i}`}
                        type="time"
                        step={300}
                        value={range.closesAt}
                        disabled={!canManage}
                        onChange={(e) =>
                          update(weekday, (rs) =>
                            rs.map((r, j) => (j === i ? { ...r, closesAt: e.target.value } : r)),
                          )
                        }
                        className={cn(input, 'w-full min-w-0', message && 'ring-2 ring-red/50')}
                      />
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => update(weekday, (rs) => rs.filter((_, j) => j !== i))}
                          aria-label={t('removeRange')}
                          className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
                        >
                          <X className="size-5" aria-hidden />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                  {message ? (
                    <p
                      role="alert"
                      className="text-[14px] font-medium text-[#C00011] dark:text-red"
                    >
                      {message}
                    </p>
                  ) : null}
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      {ranges.length < 4 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            update(weekday, (rs) => [
                              ...rs,
                              { opensAt: '18:30', closesAt: '22:30' },
                            ])
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          {t('addRange')}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDrafts((d) => ({
                            ...d,
                            [service]: Object.fromEntries(
                              WEEKDAYS.map((w) => [w, ranges.map((r) => ({ ...r }))]),
                            ),
                          }))
                        }
                      >
                        <Copy className="size-4" aria-hidden />
                        {t('copyToAll')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
      {canManage ? (
        <Button onClick={save} loading={pending} disabled={errors.length > 0}>
          {saveLabel ?? ta('save')}
        </Button>
      ) : null}

      {showClosures ? <Closures closures={closures} canManage={canManage} locale={locale} /> : null}
    </div>
  );
}

function Closures({
  closures,
  canManage,
  locale,
}: {
  closures: HoursEditorProps['closures'];
  canManage: boolean;
  locale: string;
}) {
  const t = useTranslations('admin.hours');
  const ta = useTranslations('admin');
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const label = (c: { startsOn: string; endsOn: string }) =>
    c.startsOn === c.endsOn
      ? fmt.format(new Date(c.startsOn))
      : `${fmt.format(new Date(c.startsOn))} → ${fmt.format(new Date(c.endsOn))}`;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-[20px] font-bold tracking-display">{t('closures')}</h2>
        <p className="text-fg-muted">{t('closuresHint')}</p>
      </div>
      {closures.length === 0 ? (
        <p className="flex items-center gap-2 text-fg-muted">
          <CalendarOff className="size-5" aria-hidden />
          {t('noClosures')}
        </p>
      ) : (
        <ul className="divide-y divide-line/[0.06]">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-semibold">{label(c)}</span>
                {c.reason ? (
                  <span className="block text-[14px] text-fg-muted">{c.reason}</span>
                ) : null}
              </span>
              {canManage ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${ta('delete')} : ${label(c)}`}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteClosure(c.id);
                      toast(r.ok ? ta('saved') : ta('saveError'), r.ok ? 'success' : 'error');
                    })
                  }
                >
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form
          className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addClosure({ startsOn, endsOn, reason });
              if (r.ok) {
                setReason('');
                toast(ta('saved'));
              } else toast(r.error === 'dates' ? t('errors.dates') : ta('saveError'), 'error');
            });
          }}
        >
          <div className="space-y-1">
            <label htmlFor="cl-start" className="text-[14px] font-semibold">
              {t('startsOn')}
            </label>
            <input
              id="cl-start"
              type="date"
              value={startsOn}
              min={today}
              onChange={(e) => setStartsOn(e.target.value)}
              className={cn(input, 'w-full')}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cl-end" className="text-[14px] font-semibold">
              {t('endsOn')}
            </label>
            <input
              id="cl-end"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={cn(input, 'w-full')}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cl-reason" className="text-[14px] font-semibold">
              {t('reason')}
            </label>
            <input
              id="cl-reason"
              value={reason}
              maxLength={120}
              placeholder={t('reasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
              className={cn(input, 'w-full placeholder:text-fg-muted')}
            />
          </div>
          <Button type="submit" variant="secondary" loading={pending}>
            {t('addClosure')}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
