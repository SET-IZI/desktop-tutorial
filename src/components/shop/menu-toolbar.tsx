'use client';

import { Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { filterMenu, type DietFilter, type MenuFilters } from '@/lib/menu/filters';
import type { Allergen, MenuCategory } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

const DIETS: DietFilter[] = ['vegetarian', 'vegan', 'gluten_free'];
const ALLERGENS: Allergen[] = [
  'gluten',
  'milk',
  'eggs',
  'nuts',
  'peanuts',
  'soy',
  'sesame',
  'fish',
  'crustaceans',
  'molluscs',
  'celery',
  'mustard',
  'sulphites',
  'lupin',
];

interface MenuToolbarProps {
  filters: MenuFilters;
  onChange: (filters: MenuFilters) => void;
  categories: MenuCategory[];
}

const chip =
  'inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors';

export function MenuToolbar({ filters, onChange, categories }: MenuToolbarProps) {
  const t = useTranslations('shop');
  const [allergensOpen, setAllergensOpen] = useState(false);
  const [draft, setDraft] = useState<Allergen[]>(filters.excludedAllergens);

  const draftCount = useMemo(
    () =>
      filterMenu(categories, { ...filters, excludedAllergens: draft }).reduce(
        (n, c) => n + c.products.length,
        0,
      ),
    [categories, filters, draft],
  );

  const toggleDiet = (d: DietFilter) =>
    onChange({
      ...filters,
      diets: filters.diets.includes(d)
        ? filters.diets.filter((x) => x !== d)
        : [...filters.diets, d],
    });

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="menu-search" className="sr-only">
          {t('search')}
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted"
          aria-hidden
        />
        <input
          id="menu-search"
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
          className="h-12 w-full rounded-full bg-surface pl-12 pr-12 text-body shadow-soft outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, query: '' })}
            aria-label={t('filters.reset')}
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted hover:text-fg"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DIETS.map((d) => {
          const on = filters.diets.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => toggleDiet(d)}
              className={cn(
                chip,
                on ? 'bg-fg text-bg' : 'bg-surface text-fg shadow-soft hover:bg-surface-2',
              )}
            >
              {on ? <Check className="size-4" aria-hidden /> : null}
              {t(`filters.${d}`)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setDraft(filters.excludedAllergens);
            setAllergensOpen(true);
          }}
          className={cn(
            chip,
            filters.excludedAllergens.length > 0
              ? 'bg-fg text-bg'
              : 'bg-surface text-fg shadow-soft hover:bg-surface-2',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {filters.excludedAllergens.length > 0
            ? t('filters.allergensCount', { count: filters.excludedAllergens.length })
            : t('filters.allergens')}
        </button>
      </div>

      <Sheet open={allergensOpen} onOpenChange={setAllergensOpen}>
        <SheetContent title={t('filters.allergensTitle')} description={t('filters.allergensHint')}>
          <fieldset className="pt-4">
            <legend className="sr-only">{t('filters.allergensTitle')}</legend>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const on = draft.includes(a);
                return (
                  <label
                    key={a}
                    className={cn(
                      chip,
                      'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue/60',
                      on ? 'bg-fg text-bg' : 'bg-fg/[0.06] text-fg',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => setDraft(on ? draft.filter((x) => x !== a) : [...draft, a])}
                    />
                    {on ? <Check className="size-4" aria-hidden /> : null}
                    {t(`allergens.${a}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setDraft([])}>
              {t('filters.reset')}
            </Button>
            <Button
              block
              onClick={() => {
                onChange({ ...filters, excludedAllergens: draft });
                setAllergensOpen(false);
              }}
            >
              {t('filters.apply', { count: draftCount })}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
