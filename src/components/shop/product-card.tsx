'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useMoney } from '@/hooks/use-money';
import { buildLine } from '@/lib/cart/lines';
import { useCart } from '@/lib/cart/store';
import { spring, TAP_SCALE } from '@/lib/motion';
import type { MenuCategory, MenuProduct } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';
import { DietBadges } from './badges';
import { ProductVisual } from './product-visual';

interface ProductCardProps {
  product: MenuProduct;
  category: Pick<MenuCategory, 'tone' | 'emoji'>;
  currency: string;
  onOpen: (product: MenuProduct) => void;
}

/** Un choix obligatoire (cuisson, taille…) impose de passer par la fiche. */
export const needsChoice = (p: MenuProduct) => p.optionGroups.some((g) => g.minSelect > 0);

export function ProductCard({ product, category, currency, onOpen }: ProductCardProps) {
  const t = useTranslations('shop');
  const { price } = useMoney(currency);
  const add = useCart((s) => s.add);
  const inCart = useCart((s) =>
    s.lines.filter((l) => l.productId === product.id).reduce((n, l) => n + l.quantity, 0),
  );
  const [justAdded, setJustAdded] = useState(false);
  const hasExtras = product.optionGroups.some((g) => g.options.some((o) => o.priceDeltaCents > 0));
  const priceLabel = hasExtras
    ? t('from', { price: price(product.priceCents) })
    : price(product.priceCents);

  useEffect(() => {
    if (!justAdded) return;
    const id = window.setTimeout(() => setJustAdded(false), 1200);
    return () => window.clearTimeout(id);
  }, [justAdded]);

  const quickAdd = () => {
    if (needsChoice(product)) {
      onOpen(product);
      return;
    }
    add(buildLine(product, {}, 1));
    setJustAdded(true);
  };

  return (
    <motion.div
      whileTap={product.isSoldOut ? undefined : { scale: 0.98 }}
      transition={spring}
      className="relative flex items-stretch gap-4 rounded-bento-sm bg-surface p-3 shadow-soft transition-shadow hover:shadow-float"
    >
      {/* Toute la carte ouvre la fiche ; le « + » est un bouton distinct au-dessus. */}
      <button
        type="button"
        onClick={() => onOpen(product)}
        aria-label={`${product.name}, ${priceLabel}${product.isSoldOut ? `, ${t('soldOut')}` : ''}`}
        className="absolute inset-0 z-0 rounded-bento-sm"
      />
      <div aria-hidden className="pointer-events-none flex min-w-0 flex-1 flex-col py-1 pl-1">
        <h3 className="text-[17px] font-semibold leading-snug">{product.name}</h3>
        {product.description ? (
          <p className="mt-1 line-clamp-2 text-[15px] text-fg-muted">{product.description}</p>
        ) : null}
        <DietBadges tags={product.dietTags} className="mt-2" />
        <p className="mt-auto pt-2 font-semibold tabular-nums">
          {product.isSoldOut ? (
            <span className="rounded-full bg-fg/[0.08] px-2.5 py-0.5 text-[15px]">
              {t('soldOut')}
            </span>
          ) : (
            priceLabel
          )}
        </p>
      </div>
      <div className="pointer-events-none relative shrink-0">
        <ProductVisual
          imageUrl={product.imageUrls[0]}
          alt=""
          tone={category.tone}
          emoji={category.emoji}
          sizes="112px"
          // Épuisé : seul le visuel est désaturé, le texte garde son contraste.
          className={cn(
            'size-28 rounded-[22px] text-[18px]',
            product.isSoldOut && 'opacity-50 grayscale',
          )}
        />
        <AnimatePresence>
          {inCart > 0 ? (
            <motion.span
              key="count"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={spring}
              aria-hidden
              className="absolute -left-1 -top-1 flex min-w-7 items-center justify-center rounded-full bg-fg px-2 py-0.5 text-[13px] font-bold tabular-nums text-bg shadow-soft"
            >
              {inCart}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      {!product.isSoldOut ? (
        <motion.button
          type="button"
          onClick={quickAdd}
          whileTap={{ scale: TAP_SCALE - 0.08 }}
          transition={spring}
          aria-label={
            needsChoice(product)
              ? t('chooseOptions', { name: product.name })
              : t('quickAdd', { name: product.name })
          }
          className={cn(
            'absolute bottom-2 right-2 z-10 flex size-11 items-center justify-center rounded-full shadow-float transition-colors',
            justAdded ? 'bg-green text-[#0B3D1B]' : 'bg-cta text-cta-fg',
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={justAdded ? 'check' : 'plus'}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={spring}
              className="flex"
            >
              {justAdded ? (
                <Check className="size-5" aria-hidden />
              ) : (
                <Plus className="size-5" aria-hidden />
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      ) : null}
      <span role="status" className="sr-only">
        {justAdded ? t('added', { name: product.name }) : ''}
      </span>
    </motion.div>
  );
}
