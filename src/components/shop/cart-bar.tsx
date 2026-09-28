'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassBar } from '@/components/ui/glass-bar';
import { useMoney } from '@/hooks/use-money';
import { cartCount, cartSubtotal } from '@/lib/cart/lines';
import { useCart, useCartMeta } from '@/lib/cart/store';
import { spring, TAP_SCALE } from '@/lib/motion';

export function CartBar({
  currency,
  onOpen,
  hidden,
}: {
  currency: string;
  onOpen: () => void;
  hidden: boolean;
}) {
  const t = useTranslations('shop');
  const { price } = useMoney(currency);
  const { hydrated } = useCartMeta();
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);
  const visible = hydrated && count > 0 && !hidden;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="cart-bar"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={spring}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 sm:mx-auto sm:max-w-md"
        >
          <GlassBar className="p-1.5">
            <motion.button
              type="button"
              onClick={onOpen}
              whileTap={{ scale: TAP_SCALE }}
              transition={spring}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-full bg-cta px-4 text-cta-fg"
            >
              <motion.span
                key={count}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={spring}
                className="flex size-8 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold tabular-nums"
                aria-hidden
              >
                {count}
              </motion.span>
              <span className="flex-1 text-left font-semibold">
                {t('cartBar')}
                <span className="sr-only">, {t('cartCount', { count })}</span>
              </span>
              <span className="font-semibold tabular-nums">{price(cartSubtotal(lines))}</span>
            </motion.button>
          </GlassBar>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
