'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  /** `sm` : libellés serrés (écrans étroits, plus de 2 options). */
  size?: 'md' | 'sm';
}

/** Contrôle segmenté (façon iOS) : groupe radio accessible, pastille animée. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'md',
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Flèches gauche/droite : sélection et focus sur l'option voisine (motif radio ARIA).
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const nextIndex = (index + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative flex rounded-full bg-fg/[0.06] p-1', className)}
    >
      {/* Pastille à largeur fixe qui glisse (translation seule) : pas de déformation,
          contrairement à une animation de layout dans une sheet déjà animée. */}
      <motion.span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 rounded-full bg-surface shadow-soft"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})` }}
        initial={false}
        animate={{
          x: `${
            Math.max(
              0,
              options.findIndex((o) => o.value === value),
            ) * 100
          }%`,
        }}
        transition={spring}
      />
      {options.map((o, index) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex min-h-touch flex-1 basis-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors',
              size === 'sm' ? 'px-2 text-[14px]' : 'px-4 text-[15px]',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <span className="relative flex items-center gap-2">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
