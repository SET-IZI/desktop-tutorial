'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MAX_QUANTITY } from '@/lib/cart/lines';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Autorise 0 (bouton poubelle) : utilisé dans le panier. */
  allowZero?: boolean;
  size?: 'md' | 'sm';
  label?: string;
}

export function QuantityStepper({
  value,
  onChange,
  allowZero = false,
  size = 'md',
  label,
}: QuantityStepperProps) {
  const t = useTranslations('shop');
  const min = allowZero ? 0 : 1;
  const btn = cn(
    'inline-flex items-center justify-center rounded-full bg-fg/[0.06] text-fg transition-colors hover:bg-fg/10 disabled:opacity-30',
    size === 'md' ? 'size-11' : 'size-11 sm:size-9',
  );
  const showTrash = allowZero && value === 1;
  return (
    <div
      role="group"
      aria-label={label ?? t('quantity')}
      className="inline-flex items-center gap-1"
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t('decrease')}
      >
        {showTrash ? (
          <Trash2 className="size-4" aria-hidden />
        ) : (
          <Minus className="size-4" aria-hidden />
        )}
      </button>
      <output aria-live="polite" className="min-w-8 text-center font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label={t('increase')}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
