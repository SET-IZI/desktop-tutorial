'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** id d'un texte d'aide (aria-describedby). */
  describedBy?: string;
  disabled?: boolean;
  name?: string;
}

/** Interrupteur façon iOS, rôle ARIA switch. Cible tactile 44 px. */
export function Switch({ checked, onChange, label, describedBy, disabled, name }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-touch min-w-touch shrink-0 items-center justify-center disabled:opacity-40"
    >
      {name ? <input type="hidden" name={name} value={checked ? 'on' : 'off'} /> : null}
      <span
        className={cn(
          'flex h-[31px] w-[51px] items-center rounded-full p-[2px] transition-colors duration-200',
          checked ? 'justify-end bg-green' : 'justify-start bg-fg/[0.16]',
        )}
      >
        <motion.span
          layout
          transition={spring}
          className="size-[27px] rounded-full bg-white shadow-soft"
        />
      </span>
    </button>
  );
}
