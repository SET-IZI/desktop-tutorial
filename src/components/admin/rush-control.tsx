'use client';

import { Gauge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { setRushMode } from '@/app/app/(shell)/actions';
import { useToast } from '@/components/ui/toast';
import type { RushMode } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

export interface RushState {
  mode: RushMode;
  extraMinutes: number;
}

const MODES: RushMode[] = ['off', 'extended', 'paused'];

/** Mode rush en un geste depuis l'en-tête : normal, ralenti (+X min) ou pause. */
export function RushControl({ initial, disabled }: { initial: RushState; disabled?: boolean }) {
  const t = useTranslations('admin');
  const toast = useToast();
  const [mode, setMode] = useState<RushMode>(initial.mode);
  const [pending, startTransition] = useTransition();

  const change = (next: RushMode) => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setRushMode({ mode: next });
      if (!result.ok) {
        setMode(previous);
        toast(result.error === 'forbidden' ? t('forbidden') : t('saveError'), 'error');
        return;
      }
      toast(
        next === 'off'
          ? t('rush.offHint')
          : next === 'paused'
            ? t('rush.pausedHint')
            : t('rush.extendedHint', { minutes: initial.extraMinutes }),
      );
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('rush.label')}
      aria-busy={pending}
      className="flex items-center gap-1 rounded-full bg-fg/[0.06] p-1"
    >
      <Gauge className="ml-2 hidden size-4 text-fg-muted sm:block" aria-hidden />
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          disabled={disabled}
          onClick={() => change(m)}
          className={cn(
            'min-h-[36px] flex-1 rounded-full px-3 text-[14px] font-semibold transition-colors disabled:opacity-50 sm:flex-none',
            mode === m
              ? m === 'paused'
                ? 'bg-red text-white'
                : m === 'extended'
                  ? 'bg-orange text-[#3D2600]'
                  : 'bg-surface text-fg shadow-soft'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {t(`rush.${m}`)}
        </button>
      ))}
    </div>
  );
}
