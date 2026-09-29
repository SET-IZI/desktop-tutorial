'use client';

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, Pencil, Plus, UtensilsCrossed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  reorderCategories,
  reorderProducts,
  setProductFlags,
} from '@/app/app/(shell)/carte/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useMoney } from '@/hooks/use-money';
import type { AdminCategory, AdminProduct } from '@/lib/admin/menu';
import { cn } from '@/lib/utils';
import { CategorySheet } from './category-sheet';
import { listKeyboardCoordinates } from './list-keyboard-coordinates';
import { ProductSheet } from './product-sheet';

interface MenuEditorProps {
  categories: AdminCategory[];
  restaurantId: string;
  canManage: boolean;
}

type ProductTarget = { product: AdminProduct | null; categoryId: string };

export function MenuEditor({ categories: initial, restaurantId, canManage }: MenuEditorProps) {
  const t = useTranslations('menuEditor');
  const ta = useTranslations('admin');
  const router = useRouter();
  const toast = useToast();
  const [categories, setCategories] = useState(initial);
  const [categorySheet, setCategorySheet] = useState<{
    open: boolean;
    category: AdminCategory | null;
  }>({ open: false, category: null });
  const [productSheet, setProductSheet] = useState<ProductTarget & { open: boolean }>({
    open: false,
    product: null,
    categoryId: '',
  });

  // Les données serveur font foi après chaque enregistrement (router.refresh()).
  useEffect(() => setCategories(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: listKeyboardCoordinates,
      scrollBehavior: 'auto',
    }),
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
      for (const p of c.products) map.set(p.id, p.name);
    }
    return map;
  }, [categories]);

  const positionOf = (id: string) => {
    const cat = categories.findIndex((c) => c.id === id);
    if (cat >= 0) return { position: cat + 1, total: categories.length };
    for (const c of categories) {
      const i = c.products.findIndex((p) => p.id === id);
      if (i >= 0) return { position: i + 1, total: c.products.length };
    }
    return { position: 0, total: 0 };
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.picked', { name: names.get(String(active.id)) ?? '' }),
    onDragOver: ({ active, over }) =>
      over
        ? t('dnd.over', {
            name: names.get(String(active.id)) ?? '',
            ...positionOf(String(over.id)),
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('dnd.dropped', {
            name: names.get(String(active.id)) ?? '',
            ...positionOf(String(over.id)),
          })
        : undefined,
    onDragCancel: () => t('dnd.cancelled'),
  };

  const persist = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    rollback: AdminCategory[],
  ) => {
    const result = await fn();
    if (!result.ok) {
      setCategories(rollback);
      toast(result.error === 'forbidden' ? ta('forbidden') : ta('saveError'), 'error');
    }
  };

  const onCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const before = categories;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(categories, from, to);
    setCategories(next);
    void persist(() => reorderCategories(next.map((c) => c.id)), before);
  };

  const onProductDragEnd =
    (categoryId: string) =>
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const before = categories;
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return;
      const from = category.products.findIndex((p) => p.id === active.id);
      const to = category.products.findIndex((p) => p.id === over.id);
      if (from < 0 || to < 0) return;
      const products = arrayMove(category.products, from, to);
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, products } : c)));
      void persist(() => reorderProducts(products.map((p) => p.id)), before);
    };

  const setFlags = (product: AdminProduct, flags: { isActive?: boolean; isSoldOut?: boolean }) => {
    const before = categories;
    setCategories(
      categories.map((c) =>
        c.id === product.categoryId
          ? {
              ...c,
              products: c.products.map((p) => (p.id === product.id ? { ...p, ...flags } : p)),
            }
          : c,
      ),
    );
    void persist(() => setProductFlags(product.id, flags), before);
  };

  const dndA11y = { announcements, screenReaderInstructions: { draggable: t('dnd.instructions') } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm">{t('title')}</h1>
          <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCategorySheet({ open: true, category: null })}>
            <Plus className="size-5" aria-hidden />
            {t('newCategory')}
          </Button>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <Card tone="muted" className="py-12 text-center">
          <UtensilsCrossed className="mx-auto size-8 text-fg-muted" aria-hidden />
          <p className="mt-3 text-[20px] font-semibold">{t('empty')}</p>
          <p className="mt-1 text-fg-muted">{t('emptyHint')}</p>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onCategoryDragEnd}
          accessibility={dndA11y}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-4">
              {categories.map((category) => (
                <SortableItem key={category.id} id={category.id} disabled={!canManage}>
                  {(handle) => (
                    <Card className="p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        {canManage ? (
                          <Handle label={t('move', { name: category.name })} {...handle} />
                        ) : null}
                        <h2 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-display">
                          {category.emoji ? (
                            <span aria-hidden className="mr-2">
                              {category.emoji}
                            </span>
                          ) : null}
                          {category.name}
                          <span className="ml-2 text-[15px] font-medium text-fg-muted">
                            {t('products', { count: category.products.length })}
                          </span>
                        </h2>
                        {!category.isActive ? (
                          <span className="flex items-center gap-1 rounded-full bg-fg/[0.06] px-2.5 py-0.5 text-[13px] font-semibold">
                            <EyeOff className="size-3.5" aria-hidden />
                            {t('hidden')}
                          </span>
                        ) : null}
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('edit', { name: category.name })}
                            onClick={() => setCategorySheet({ open: true, category })}
                          >
                            <Pencil className="size-5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>

                      {category.products.length === 0 ? (
                        <p className="px-2 py-4 text-fg-muted">{t('emptyCategory')}</p>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCorners}
                          onDragEnd={onProductDragEnd(category.id)}
                          accessibility={dndA11y}
                        >
                          <SortableContext
                            items={category.products.map((p) => p.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <ul className="mt-3 divide-y divide-line/[0.06]">
                              {category.products.map((product) => (
                                <SortableItem
                                  key={product.id}
                                  id={product.id}
                                  disabled={!canManage}
                                >
                                  {(productHandle) => (
                                    <ProductRow
                                      product={product}
                                      emoji={category.emoji}
                                      canManage={canManage}
                                      handle={productHandle}
                                      onEdit={() =>
                                        setProductSheet({
                                          open: true,
                                          product,
                                          categoryId: category.id,
                                        })
                                      }
                                      onFlags={(f) => setFlags(product, f)}
                                    />
                                  )}
                                </SortableItem>
                              ))}
                            </ul>
                          </SortableContext>
                        </DndContext>
                      )}

                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            setProductSheet({ open: true, product: null, categoryId: category.id })
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          {t('addProduct')}
                        </Button>
                      ) : null}
                    </Card>
                  )}
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <CategorySheet
        open={categorySheet.open}
        category={categorySheet.category}
        onClose={() => setCategorySheet((s) => ({ ...s, open: false }))}
        onSaved={() => router.refresh()}
      />
      <ProductSheet
        open={productSheet.open}
        product={productSheet.product}
        categoryId={productSheet.categoryId}
        categories={categories}
        restaurantId={restaurantId}
        onClose={() => setProductSheet((s) => ({ ...s, open: false }))}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

type HandleProps = {
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
};

function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: HandleProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-90 [&>*]:shadow-float')}
    >
      {children({ setActivatorNodeRef, attributes, listeners })}
    </li>
  );
}

function Handle({
  label,
  setActivatorNodeRef,
  attributes,
  listeners,
}: HandleProps & { label: string }) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-fg-muted hover:bg-fg/[0.06] active:cursor-grabbing"
    >
      <GripVertical className="size-5" aria-hidden />
    </button>
  );
}

function ProductRow({
  product,
  emoji,
  canManage,
  handle,
  onEdit,
  onFlags,
}: {
  product: AdminProduct;
  emoji: string;
  canManage: boolean;
  handle: HandleProps;
  onEdit: () => void;
  onFlags: (flags: { isActive?: boolean; isSoldOut?: boolean }) => void;
}) {
  const t = useTranslations('menuEditor');
  const { price } = useMoney();
  return (
    <div className="flex items-center gap-2 py-2">
      {canManage ? <Handle label={t('move', { name: product.name })} {...handle} /> : null}
      <button
        type="button"
        onClick={onEdit}
        disabled={!canManage}
        aria-label={t('edit', { name: product.name })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left hover:bg-fg/[0.04] disabled:cursor-default"
      >
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-fg/[0.06] text-[20px]">
          {product.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniature
            <img src={product.imageUrls[0]} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{emoji}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate font-semibold',
              !product.isActive && 'text-fg-muted line-through',
            )}
          >
            {product.name}
          </span>
          <span className="block text-[14px] tabular-nums text-fg-muted">
            {price(product.priceCents)}
            {product.optionGroups.length > 0
              ? ` · ${product.optionGroups.map((g) => g.name).join(', ')}`
              : ''}
          </span>
        </span>
      </button>
      {canManage ? (
        <>
          <button
            type="button"
            aria-pressed={product.isSoldOut}
            aria-label={
              product.isSoldOut
                ? t('markAvailable', { name: product.name })
                : t('markSoldOut', { name: product.name })
            }
            onClick={() => onFlags({ isSoldOut: !product.isSoldOut })}
            className={cn(
              'min-h-touch shrink-0 rounded-full px-3 text-[13px] font-semibold transition-colors',
              product.isSoldOut
                ? 'bg-orange text-[#3D2600]'
                : 'bg-fg/[0.06] text-fg-muted hover:text-fg',
            )}
          >
            {product.isSoldOut ? t('soldOutOn') : t('soldOut')}
          </button>
          <Switch
            label={`${t('visible')} · ${product.name}`}
            checked={product.isActive}
            onChange={(v) => onFlags({ isActive: v })}
          />
        </>
      ) : null}
    </div>
  );
}
