'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { spring, TAP_SCALE } from '@/lib/motion';
import { applyTheme, effectiveTheme, storeTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Bouton clair/sombre (Liquid Glass). Le thème du système reste la valeur par défaut. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common');
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(effectiveTheme());
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(effectiveTheme());
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storeTheme(next);
    setTheme(next);
  };

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: TAP_SCALE }}
      transition={spring}
      aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
      className={cn(
        'glass flex size-11 items-center justify-center rounded-full text-fg shadow-float',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme ?? 'unknown'}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={spring}
          className="flex"
        >
          {theme === 'dark' ? (
            <Sun className="size-5" aria-hidden />
          ) : (
            <Moon className="size-5" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
