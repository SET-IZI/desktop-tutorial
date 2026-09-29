'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error';
interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Confirmation discrète en bas de l'écran (glass), lue par les lecteurs d'écran. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();

  const show = useCallback((message: string, tone: Tone = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-[70] flex justify-center px-4 lg:bottom-8"
      >
        <AnimatePresence>
          {toast ? (
            <motion.p
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={spring}
              className="glass glass-thick flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold shadow-float"
            >
              {toast.tone === 'success' ? (
                <CheckCircle2 className="size-5 text-green" aria-hidden />
              ) : (
                <XCircle className={cn('size-5 text-red')} aria-hidden />
              )}
              {toast.message}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
