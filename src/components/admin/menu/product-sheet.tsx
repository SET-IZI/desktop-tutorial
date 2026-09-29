'use client';

import { Check, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { deleteProduct, saveProduct } from '@/app/app/(shell)/carte/actions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import type { AdminCategory, AdminProduct } from '@/lib/admin/menu';
import { formatEuroInput, parseEuroInput } from '@/lib/admin/price-input';
import { ALLERGENS, DIET_TAGS, productSchema } from '@/lib/admin/product-schema';
import { cn } from '@/lib/utils';
import { ImageUpload } from './image-upload';

interface DraftOption {
  key: string;
  id?: string;
  name: string;
  price: string;
  isActive: boolean;
}
interface DraftGroup {
  key: string;
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  maxSelect: number;
  options: DraftOption[];
}
interface Draft {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  dietTags: (typeof DIET_TAGS)[number][];
  allergens: (typeof ALLERGENS)[number][];
  isActive: boolean;
  isSoldOut: boolean;
  isUpsell: boolean;
  groups: DraftGroup[];
}

const key = () => crypto.randomUUID();

function toDraft(product: AdminProduct | null, categoryId: string): Draft {
  if (!product) {
    return {
      categoryId,
      name: '',
      description: '',
      price: '',
      imageUrl: null,
      dietTags: [],
      allergens: [],
      isActive: true,
      isSoldOut: false,
      isUpsell: false,
      groups: [],
    };
  }
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: formatEuroInput(product.priceCents),
    imageUrl: product.imageUrls[0] ?? null,
    dietTags: product.dietTags,
    allergens: product.allergens,
    isActive: product.isActive,
    isSoldOut: product.isSoldOut,
    isUpsell: product.isUpsell,
    groups: product.optionGroups.map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      required: g.minSelect > 0,
      multiple: g.maxSelect > 1,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        key: o.id,
        id: o.id,
        name: o.name,
        price: o.priceDeltaCents ? formatEuroInput(o.priceDeltaCents) : '',
        isActive: o.isActive,
      })),
    })),
  };
}

const input =
  'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50';
const chip =
  'inline-flex min-h-touch items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors';

interface ProductSheetProps {
  open: boolean;
  onClose: () => void;
  product: AdminProduct | null;
  categoryId: string;
  categories: AdminCategory[];
  restaurantId: string;
  onSaved: () => void;
}

export function ProductSheet({
  open,
  onClose,
  product,
  categoryId,
  categories,
  restaurantId,
  onSaved,
}: ProductSheetProps) {
  const t = useTranslations('menuEditor');
  const tp = useTranslations('menuEditor.product');
  const ts = useTranslations('shop.allergens');
  const tc = useTranslations('common');
  const ta = useTranslations('admin');
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(product, categoryId));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setDraft(toDraft(product, categoryId));
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, product, categoryId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setGroup = (gKey: string, patch: Partial<DraftGroup>) =>
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.key === gKey ? { ...g, ...patch } : g)),
    }));
  const setOption = (gKey: string, oKey: string, patch: Partial<DraftOption>) =>
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) =>
        g.key === gKey
          ? { ...g, options: g.options.map((o) => (o.key === oKey ? { ...o, ...patch } : o)) }
          : g,
      ),
    }));
  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const priceCents = parseEuroInput(draft.price);
    const optionPrices = draft.groups.flatMap((g) =>
      g.options.map((o) => (o.price.trim() ? parseEuroInput(o.price) : 0)),
    );
    if (optionPrices.some((p) => p === null)) {
      setError(tp('errors.optionPrice'));
      return;
    }
    const payload = {
      id: draft.id,
      categoryId: draft.categoryId,
      name: draft.name,
      description: draft.description,
      priceCents: priceCents ?? Number.NaN,
      imageUrls: draft.imageUrl ? [draft.imageUrl] : [],
      dietTags: draft.dietTags,
      allergens: draft.allergens,
      isActive: draft.isActive,
      isSoldOut: draft.isSoldOut,
      isUpsell: draft.isUpsell,
      optionGroups: draft.groups.map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.required ? 1 : 0,
        maxSelect: g.multiple ? Math.max(g.maxSelect, g.required ? 1 : 1) : 1,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaCents: o.price.trim() ? (parseEuroInput(o.price) ?? 0) : 0,
          isActive: o.isActive,
        })),
      })),
    };
    const local = productSchema.safeParse(payload);
    if (!local.success) {
      setError(tp(`errors.${local.error.issues[0]?.message ?? 'name'}` as 'errors.name'));
      return;
    }
    start(async () => {
      const result = await saveProduct(payload);
      if (!result.ok) {
        toast(result.error === 'forbidden' ? ta('forbidden') : ta('saveError'), 'error');
        return;
      }
      toast(ta('saved'));
      onSaved();
      onClose();
    });
  };

  const remove = () =>
    start(async () => {
      if (!draft.id) return;
      const result = await deleteProduct(draft.id);
      if (!result.ok) {
        toast(ta('saveError'), 'error');
        return;
      }
      toast(ta('saved'));
      onSaved();
      onClose();
    });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={draft.id ? tp('edit') : tp('create')}
        closeLabel={tc('close')}
        className="sm:max-w-2xl"
        footer={
          <div className="flex flex-wrap items-center gap-3">
            {draft.id ? (
              confirmDelete ? (
                <Button variant="destructive" onClick={remove} loading={pending}>
                  {tp('confirm')}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={tp('delete')}
                >
                  <Trash2 className="size-5" aria-hidden />
                  <span className="hidden sm:inline">{tp('delete')}</span>
                </Button>
              )
            ) : null}
            <Button type="submit" form="admin-product-form" className="ml-auto" loading={pending}>
              {ta('save')}
            </Button>
          </div>
        }
      >
        <form id="admin-product-form" onSubmit={submit} noValidate className="space-y-6 pb-2 pt-3">
          {confirmDelete ? (
            <p role="alert" className="rounded-2xl bg-red/10 px-4 py-3 font-medium">
              {tp('confirmDelete', { name: draft.name })}
            </p>
          ) : null}

          <ImageUpload
            restaurantId={restaurantId}
            value={draft.imageUrl}
            onChange={(url) => set('imageUrl', url)}
            alt={draft.name}
          />

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <label htmlFor="p-name" className="font-semibold">
                {tp('name')}
              </label>
              <input
                id="p-name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={80}
                required
                className={input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="p-price" className="font-semibold">
                {tp('price')}
              </label>
              <div className="relative">
                <input
                  id="p-price"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="13,50"
                  className={cn(input, 'pr-10 tabular-nums')}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted">
                  €
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-desc" className="font-semibold">
              {tp('description')}
            </label>
            <textarea
              id="p-desc"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={600}
              rows={3}
              placeholder={tp('descriptionPlaceholder')}
              className={cn(input, 'h-auto resize-none py-3')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="p-category" className="font-semibold">
              {tp('category')}
            </label>
            <select
              id="p-category"
              value={draft.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              className={input}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="font-semibold">{tp('diet')}</legend>
            <div className="flex flex-wrap gap-2">
              {DIET_TAGS.map((tag) => {
                const on = draft.dietTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('dietTags', toggle(draft.dietTags, tag))}
                    className={cn(chip, on ? 'bg-fg text-bg' : 'bg-fg/[0.06] text-fg')}
                  >
                    {on ? <Check className="size-4" aria-hidden /> : null}
                    {t(`diet.${tag}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-semibold">{tp('allergens')}</legend>
            <p className="text-[14px] text-fg-muted">{tp('allergensHint')}</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const on = draft.allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('allergens', toggle(draft.allergens, a))}
                    className={cn(chip, on ? 'bg-orange text-[#3D2600]' : 'bg-fg/[0.06] text-fg')}
                  >
                    {on ? <Check className="size-4" aria-hidden /> : null}
                    {ts(a)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="divide-y divide-line/[0.06] rounded-2xl bg-fg/[0.03] px-4">
            {(
              [
                ['isActive', tp('visible'), undefined],
                ['isSoldOut', tp('soldOut'), undefined],
                ['isUpsell', tp('upsell'), tp('upsellHint')],
              ] as const
            ).map(([k, label, hint]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block font-semibold">{label}</span>
                  {hint ? <span className="block text-[14px] text-fg-muted">{hint}</span> : null}
                </span>
                <Switch label={label} checked={draft[k]} onChange={(v) => set(k, v)} />
              </div>
            ))}
          </div>

          <section aria-labelledby="options-title" className="space-y-3">
            <div>
              <h3 id="options-title" className="text-[20px] font-bold tracking-display">
                {tp('options')}
              </h3>
              <p className="text-[14px] text-fg-muted">{tp('optionsHint')}</p>
            </div>
            {draft.groups.map((g, gi) => (
              <div key={g.key} className="space-y-3 rounded-2xl bg-fg/[0.03] p-4">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label htmlFor={`g-${g.key}`} className="text-[14px] font-semibold">
                      {tp('groupName')}
                    </label>
                    <input
                      id={`g-${g.key}`}
                      value={g.name}
                      onChange={(e) => setGroup(g.key, { name: e.target.value })}
                      placeholder={tp('groupNamePlaceholder')}
                      maxLength={60}
                      className={input}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tp('removeGroup', { name: g.name || String(gi + 1) })}
                    onClick={() =>
                      setDraft((d) => ({ ...d, groups: d.groups.filter((x) => x.key !== g.key) }))
                    }
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="flex items-center gap-1 text-[15px] font-medium">
                    <Switch
                      label={`${tp('required')} · ${g.name}`}
                      checked={g.required}
                      onChange={(v) => setGroup(g.key, { required: v })}
                    />
                    {tp('required')}
                  </span>
                  <span className="flex items-center gap-1 text-[15px] font-medium">
                    <Switch
                      label={`${tp('multiple')} · ${g.name}`}
                      checked={g.multiple}
                      onChange={(v) =>
                        setGroup(g.key, {
                          multiple: v,
                          maxSelect: v ? Math.max(2, g.maxSelect) : 1,
                        })
                      }
                    />
                    {tp('multiple')}
                  </span>
                  {g.multiple ? (
                    <label className="flex items-center gap-2 text-[15px] font-medium">
                      {tp('maxChoices')}
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={g.maxSelect}
                        onChange={(e) =>
                          setGroup(g.key, {
                            maxSelect: Math.min(20, Math.max(2, Number(e.target.value) || 2)),
                          })
                        }
                        className="h-11 w-16 rounded-xl bg-fg/[0.06] px-2 text-center tabular-nums"
                      />
                    </label>
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {g.options.map((o) => (
                    <li
                      key={o.key}
                      className="grid grid-cols-[minmax(0,1fr)_7rem_2.75rem] items-center gap-2"
                    >
                      <input
                        aria-label={tp('optionName')}
                        value={o.name}
                        onChange={(e) => setOption(g.key, o.key, { name: e.target.value })}
                        placeholder={tp('optionNamePlaceholder')}
                        maxLength={60}
                        className={input}
                      />
                      <div className="relative">
                        <input
                          aria-label={`${tp('optionPrice')} · ${o.name}`}
                          inputMode="decimal"
                          value={o.price}
                          onChange={(e) => setOption(g.key, o.key, { price: e.target.value })}
                          placeholder="+0,00"
                          className={cn(input, 'pr-8 tabular-nums')}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">
                          €
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tp('removeOption', { name: o.name || '…' })}
                        onClick={() =>
                          setGroup(g.key, { options: g.options.filter((x) => x.key !== o.key) })
                        }
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setGroup(g.key, {
                      options: [...g.options, { key: key(), name: '', price: '', isActive: true }],
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {tp('addOption')}
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  groups: [
                    ...d.groups,
                    {
                      key: key(),
                      name: '',
                      required: true,
                      multiple: false,
                      maxSelect: 1,
                      options: [{ key: key(), name: '', price: '', isActive: true }],
                    },
                  ],
                }))
              }
            >
              <Plus className="size-5" aria-hidden />
              {tp('addGroup')}
            </Button>
          </section>

          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-red/10 px-4 py-3 text-[15px] font-medium text-[#C00011] dark:text-red"
            >
              {error}
            </p>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}
