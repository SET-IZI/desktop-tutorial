'use client';

import { Bike, Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useMoney } from '@/hooks/use-money';
import { buildLine, cartSubtotal, lineTotal } from '@/lib/cart/lines';
import { useCart } from '@/lib/cart/store';
import { suggestUpsell } from '@/lib/menu/upsell';
import type { Fulfillment, MenuProduct, Storefront } from '@/lib/storefront/types';
import { QuantityStepper } from './quantity-stepper';
import { SlotPicker } from './slot-picker';

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefront: Storefront;
  fulfillments: Fulfillment[];
  onOpenProduct: (product: MenuProduct) => void;
}

export function CartSheet({
  open,
  onOpenChange,
  storefront,
  fulfillments,
  onOpenProduct,
}: CartSheetProps) {
  const t = useTranslations('shop');
  const tc = useTranslations('common');
  const { restaurant, location, categories } = storefront;
  const { price } = useMoney(restaurant.currency);

  const lines = useCart((s) => s.lines);
  const fulfillment = useCart((s) => s.fulfillment);
  const slot = useCart((s) => s.slot);
  const setQuantity = useCart((s) => s.setQuantity);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const setSlot = useCart((s) => s.setSlot);
  const add = useCart((s) => s.add);

  const upsell = useMemo(() => suggestUpsell(categories, lines), [categories, lines]);
  const subtotal = cartSubtotal(lines);
  const empty = lines.length === 0;

  const addUpsell = (product: MenuProduct) => {
    // Options obligatoires : on ouvre la fiche. Sinon, ajout direct.
    if (product.optionGroups.some((g) => g.minSelect > 0)) {
      onOpenChange(false);
      onOpenProduct(product);
    } else {
      add(buildLine(product, {}, 1));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={empty ? t('cartTitle') : t('cartDelicious')}
        closeLabel={tc('close')}
        footer={
          empty ? undefined : (
            <div className="space-y-3">
              <p className="flex justify-between text-[17px]">
                <span>{t('subtotal')}</span>
                <span className="font-semibold tabular-nums">{price(subtotal)}</span>
              </p>
              {slot ? (
                <Button asChild block>
                  <Link href={`/s/${restaurant.slug}/checkout`}>{t('continue')}</Link>
                </Button>
              ) : (
                <Button block disabled>
                  {t('chooseSlot')}
                </Button>
              )}
            </div>
          )
        }
      >
        <div className="space-y-6 pb-2 pt-3">
          {fulfillments.length > 1 ? (
            <Segmented<Fulfillment>
              label={t('howTo')}
              value={fulfillment}
              onChange={setFulfillment}
              options={[
                {
                  value: 'pickup',
                  label: t('pickup'),
                  icon: <ShoppingBag className="size-4" aria-hidden />,
                },
                {
                  value: 'delivery',
                  label: t('delivery'),
                  icon: <Bike className="size-4" aria-hidden />,
                },
              ]}
            />
          ) : null}
          {fulfillment === 'delivery' ? (
            <p className="text-[15px] text-fg-muted">{t('deliveryAddressNext')}</p>
          ) : null}

          {empty ? (
            <div className="py-8 text-center">
              <p className="text-[20px] font-semibold">{t('cartEmpty')}</p>
              <p className="mt-1 text-fg-muted">{t('cartEmptyHint')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/[0.06]" aria-label={t('cartTitle')}>
              {lines.map((line) => (
                <li key={line.key} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{line.name}</p>
                    {line.options.length > 0 ? (
                      <p className="text-[15px] text-fg-muted">
                        {line.options.map((o) => o.name).join(' · ')}
                      </p>
                    ) : null}
                    {line.notes ? (
                      <p className="text-[15px] italic text-fg-muted">« {line.notes} »</p>
                    ) : null}
                    <p className="mt-1 font-semibold tabular-nums">{price(lineTotal(line))}</p>
                  </div>
                  <QuantityStepper
                    size="sm"
                    allowZero
                    value={line.quantity}
                    onChange={(q) => setQuantity(line.key, q)}
                    label={`${t('quantity')} · ${line.name}`}
                  />
                </li>
              ))}
            </ul>
          )}

          {upsell.length > 0 ? (
            <section aria-labelledby="upsell-title">
              <h3 id="upsell-title" className="text-[20px] font-bold tracking-display">
                {t('upsellTitle')}
              </h3>
              <ul className="-mx-6 mt-3 flex gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upsell.map((p) => (
                  <li key={p.id} className="w-40 shrink-0">
                    <button
                      type="button"
                      onClick={() => addUpsell(p)}
                      className="flex h-full w-full flex-col rounded-bento-sm bg-surface p-3 text-left shadow-soft"
                      aria-label={`${t('add')} ${p.name}, ${price(p.priceCents)}`}
                    >
                      <span className="line-clamp-2 font-semibold">{p.name}</span>
                      <span className="mt-auto flex items-center justify-between pt-3">
                        <span className="tabular-nums">{price(p.priceCents)}</span>
                        <span
                          aria-hidden
                          className="flex size-8 items-center justify-center rounded-full bg-cta text-cta-fg"
                        >
                          <Plus className="size-4" />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!empty ? (
            <SlotPicker
              slug={restaurant.slug}
              timezone={location.timezone}
              service={fulfillment}
              value={slot}
              onChange={setSlot}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
