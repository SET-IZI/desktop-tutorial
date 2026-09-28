'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useMoney } from '@/hooks/use-money';
import {
  buildLine,
  selectionUnitPrice,
  validateSelection,
  type Selection,
  type SelectionError,
} from '@/lib/cart/lines';
import type { MenuCategory, MenuOptionGroup, MenuProduct } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';
import { useCart } from '@/lib/cart/store';
import { DietBadges } from './badges';
import { ProductVisual } from './product-visual';
import { QuantityStepper } from './quantity-stepper';

interface ProductSheetProps {
  product: MenuProduct | null;
  category: Pick<MenuCategory, 'tone' | 'emoji'> | null;
  currency: string;
  onClose: () => void;
  onAdded?: (product: MenuProduct) => void;
}

/** Sélection par défaut : rien de coché, le client choisit (pas de choix implicite). */
const emptySelection = (): Selection => ({});

export function ProductSheet({ product, category, currency, onClose, onAdded }: ProductSheetProps) {
  const t = useTranslations('shop');
  const tc = useTranslations('common');
  const { price, delta } = useMoney(currency);
  const add = useCart((s) => s.add);

  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Réinitialise le formulaire à chaque nouveau produit.
  useEffect(() => {
    setSelection(emptySelection());
    setQuantity(1);
    setNotes('');
    setShowErrors(false);
  }, [product?.id]);

  const errors = useMemo(
    () => (product ? validateSelection(product, selection) : []),
    [product, selection],
  );
  const total = product ? selectionUnitPrice(product, selection) * quantity : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (errors.length > 0) {
      setShowErrors(true);
      const first = formRef.current?.querySelector<HTMLElement>(
        `[data-group="${errors[0]!.groupId}"]`,
      );
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
      return;
    }
    add(buildLine(product, selection, quantity, notes));
    onAdded?.(product);
    onClose();
  };

  return (
    <Sheet open={product !== null} onOpenChange={(open) => !open && onClose()}>
      {product && category ? (
        <SheetContent
          title={product.name}
          description={product.description ?? undefined}
          closeLabel={tc('close')}
        >
          <form ref={formRef} onSubmit={submit} className="space-y-6 pb-2 pt-3">
            <ProductVisual
              imageUrl={product.imageUrls[0]}
              alt={product.name}
              tone={category.tone}
              emoji={category.emoji}
              sizes="(min-width: 640px) 512px, 100vw"
              priority
              className="aspect-[16/10] w-full rounded-bento-sm text-[28px]"
            />

            <div className="space-y-2">
              <DietBadges tags={product.dietTags} />
              <p className="text-[15px] text-fg-muted">
                {product.allergens.length > 0
                  ? t('allergenList', {
                      list: product.allergens.map((a) => t(`allergens.${a}`)).join(', '),
                    })
                  : t('noAllergens')}
              </p>
            </div>

            {product.optionGroups.map((group) => (
              <OptionGroupField
                key={group.id}
                group={group}
                value={selection[group.id] ?? []}
                onChange={(ids) => setSelection((s) => ({ ...s, [group.id]: ids }))}
                error={showErrors ? errors.find((e) => e.groupId === group.id) : undefined}
                formatDelta={delta}
              />
            ))}

            <div>
              <label htmlFor="product-notes" className="text-[17px] font-semibold">
                {t('notes')}
              </label>
              <textarea
                id="product-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder={t('notesPlaceholder')}
                className="mt-2 w-full resize-none rounded-[20px] bg-fg/[0.06] px-4 py-3 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50"
              />
            </div>

            <div className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t border-line/[0.08] bg-[rgb(var(--glass-bg)/0.97)] px-6 pb-1 pt-4">
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <Button type="submit" block disabled={product.isSoldOut}>
                {product.isSoldOut ? t('soldOut') : t('addWithPrice', { price: price(total) })}
              </Button>
            </div>
          </form>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

interface OptionGroupFieldProps {
  group: MenuOptionGroup;
  value: string[];
  onChange: (ids: string[]) => void;
  error?: SelectionError;
  formatDelta: (cents: number) => string;
}

function OptionGroupField({ group, value, onChange, error, formatDelta }: OptionGroupFieldProps) {
  const t = useTranslations('shop');
  const single = group.maxSelect === 1;
  const required = group.minSelect > 0;
  const full = !single && value.length >= group.maxSelect;
  const errorId = `err-${group.id}`;

  const hint = required
    ? single
      ? `${t('required')} · ${t('chooseOne')}`
      : `${t('required')} · ${t('upTo', { count: group.maxSelect })}`
    : single
      ? t('optional')
      : `${t('optional')} · ${t('upTo', { count: group.maxSelect })}`;

  return (
    <fieldset
      data-group={group.id}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="flex w-full items-baseline justify-between gap-3">
        <span className="text-[17px] font-semibold">{group.name}</span>
        <span className={cn('text-[13px] font-medium', required ? 'text-fg' : 'text-fg-muted')}>
          {hint}
        </span>
      </legend>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-[15px] font-medium text-[#C00011] dark:text-red"
        >
          {error.kind === 'max'
            ? t('errorMax', { count: group.maxSelect })
            : t('errorMin', { count: Math.max(1, group.minSelect) })}
        </p>
      ) : null}
      <div className="mt-3 overflow-hidden rounded-[20px] bg-fg/[0.04]">
        {group.options.map((option, i) => {
          const checked = value.includes(option.id);
          const disabled = !checked && full;
          return (
            <label
              key={option.id}
              className={cn(
                'flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2 transition-colors has-[:focus-visible]:bg-blue/10',
                i > 0 && 'border-t border-line/[0.06]',
                disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <input
                // Choix unique obligatoire : radio. Choix unique facultatif : case décochable.
                type={single && required ? 'radio' : 'checkbox'}
                name={group.id}
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    single
                      ? checked && !required
                        ? []
                        : [option.id]
                      : checked
                        ? value.filter((id) => id !== option.id)
                        : [...value, option.id],
                  )
                }
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center border-2 transition-colors',
                  single ? 'rounded-full' : 'rounded-md',
                  checked ? 'border-cta bg-cta' : 'border-fg/25',
                )}
              >
                {checked ? (
                  <span
                    className={cn(
                      'bg-cta-fg',
                      single ? 'size-2.5 rounded-full' : 'size-2.5 rounded-sm',
                    )}
                  />
                ) : null}
              </span>
              <span className="flex-1">{option.name}</span>
              {option.priceDeltaCents > 0 ? (
                <span className="text-[15px] tabular-nums text-fg-muted">
                  {formatDelta(option.priceDeltaCents)}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
