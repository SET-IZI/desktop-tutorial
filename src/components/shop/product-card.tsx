'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useMoney } from '@/hooks/use-money';
import { spring } from '@/lib/motion';
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

export function ProductCard({ product, category, currency, onOpen }: ProductCardProps) {
  const t = useTranslations('shop');
  const { price } = useMoney(currency);
  const hasExtras = product.optionGroups.some((g) => g.options.some((o) => o.priceDeltaCents > 0));

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(product)}
      whileTap={product.isSoldOut ? undefined : { scale: 0.98 }}
      transition={spring}
      aria-label={`${product.name}, ${hasExtras ? t('from', { price: price(product.priceCents) }) : price(product.priceCents)}${product.isSoldOut ? `, ${t('soldOut')}` : ''}`}
      className={cn(
        'group flex w-full items-stretch gap-4 rounded-bento-sm bg-surface p-3 text-left shadow-soft transition-shadow hover:shadow-float',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col py-1 pl-1">
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
          ) : hasExtras ? (
            t('from', { price: price(product.priceCents) })
          ) : (
            price(product.priceCents)
          )}
        </p>
      </div>
      <div className="relative shrink-0">
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
        {!product.isSoldOut ? (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex size-10 items-center justify-center rounded-full bg-cta text-cta-fg shadow-float"
          >
            <Plus className="size-5" />
          </span>
        ) : null}
      </div>
    </motion.button>
  );
}
