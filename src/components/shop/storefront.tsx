'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { CartProvider, useCartMeta } from '@/lib/cart/store';
import { readableTextOn, toRgbChannels } from '@/lib/color';
import { EMPTY_FILTERS, filterMenu, hasActiveFilters, type MenuFilters } from '@/lib/menu/filters';
import type {
  Fulfillment,
  MenuProduct,
  Storefront as StorefrontData,
} from '@/lib/storefront/types';
import { CartBar } from './cart-bar';
import { CartSheet } from './cart-sheet';
import { CategoryNav, categoryAnchor } from './category-nav';
import { MenuToolbar } from './menu-toolbar';
import { ProductCard } from './product-card';
import { ProductSheet } from './product-sheet';
import { StoreHeader } from './store-header';

export function Storefront({ storefront }: { storefront: StorefrontData }) {
  const { restaurant, location, categories } = storefront;
  const fulfillments = useMemo<Fulfillment[]>(
    () => [
      ...(location.pickupEnabled ? (['pickup'] as const) : []),
      ...(location.deliveryEnabled ? (['delivery'] as const) : []),
    ],
    [location.pickupEnabled, location.deliveryEnabled],
  );

  // Accent du restaurant, avec un texte lisible dessus.
  const accentStyle = {
    '--accent': toRgbChannels(restaurant.accentColor),
    '--accent-fg': toRgbChannels(readableTextOn(restaurant.accentColor)),
  } as React.CSSProperties;

  return (
    <CartProvider slug={restaurant.slug} categories={categories} fulfillments={fulfillments}>
      <div style={accentStyle} className="min-h-dvh pb-32">
        <StorefrontBody storefront={storefront} fulfillments={fulfillments} />
      </div>
    </CartProvider>
  );
}

function StorefrontBody({
  storefront,
  fulfillments,
}: {
  storefront: StorefrontData;
  fulfillments: Fulfillment[];
}) {
  const t = useTranslations('shop');
  const { restaurant, categories } = storefront;
  const { removed } = useCartMeta();
  const [filters, setFilters] = useState<MenuFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<MenuProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const visible = useMemo(() => filterMenu(categories, filters), [categories, filters]);
  const count = visible.reduce((n, c) => n + c.products.length, 0);
  const categoryOf = (p: MenuProduct | null) =>
    categories.find((c) => c.id === p?.categoryId) ?? null;

  return (
    <>
      <StoreHeader storefront={storefront} />
      <CategoryNav categories={visible} />

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <MenuToolbar filters={filters} onChange={setFilters} categories={categories} />
        {/* Visible : sur mobile, le clavier cache souvent la carte filtrée. */}
        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-[1.5em] px-1 text-[15px] font-medium text-fg"
        >
          {hasActiveFilters(filters) ? t('results', { count }) : ''}
        </p>

        {removed.length > 0 ? (
          <p role="status" className="mt-4 rounded-2xl bg-orange/10 px-4 py-3 text-[15px]">
            {t('cartRemoved', { list: removed.join(', ') })}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[22px] font-semibold">{t('noResults')}</p>
            <p className="mt-1 text-fg-muted">{t('noResultsHint')}</p>
            <Button variant="secondary" className="mt-6" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('resetFilters')}
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-10">
            {visible.map((category) => (
              <section
                key={category.id}
                id={categoryAnchor(category.id)}
                aria-labelledby={`${categoryAnchor(category.id)}-title`}
                tabIndex={-1}
                className="scroll-mt-24 focus:outline-none"
              >
                <Reveal>
                  <h2
                    id={`${categoryAnchor(category.id)}-title`}
                    className="text-[28px] font-bold tracking-display"
                  >
                    {category.emoji ? (
                      <span aria-hidden className="mr-2">
                        {category.emoji}
                      </span>
                    ) : null}
                    {category.name}
                  </h2>
                  {category.description ? (
                    <p className="mt-1 text-fg-muted">{category.description}</p>
                  ) : null}
                </Reveal>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {category.products.map((product, index) => (
                    <Reveal as="li" key={product.id} delay={Math.min(index, 4) * 0.05}>
                      <ProductCard
                        product={product}
                        category={category}
                        currency={restaurant.currency}
                        onOpen={setSelected}
                      />
                    </Reveal>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <ProductSheet
        product={selected}
        category={categoryOf(selected)}
        currency={restaurant.currency}
        onClose={() => setSelected(null)}
      />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        storefront={storefront}
        fulfillments={fulfillments}
        onOpenProduct={setSelected}
      />
      <CartBar
        currency={restaurant.currency}
        onOpen={() => setCartOpen(true)}
        hidden={cartOpen || selected !== null}
      />
    </>
  );
}
