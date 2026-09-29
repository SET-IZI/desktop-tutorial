'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { deleteCategory, saveCategory } from '@/app/app/(shell)/carte/actions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import type { AdminCategory } from '@/lib/admin/menu';
import { TONES } from '@/lib/admin/product-schema';
import { cn } from '@/lib/utils';

/** Emojis de catégorie proposés (le champ reste libre). */
const EMOJIS = [
  '🥗',
  '🍔',
  '🍕',
  '🌮',
  '🍜',
  '🍣',
  '🥘',
  '🍲',
  '🍝',
  '🥪',
  '🍗',
  '🥩',
  '🐟',
  '🥙',
  '🍛',
  '🥟',
  '🍟',
  '🧀',
  '🍰',
  '🍦',
  '🧁',
  '🍪',
  '🥐',
  '🥤',
  '🍷',
  '🍺',
  '☕',
  '🧃',
  '🌱',
  '⭐',
];

const TONE_BG: Record<(typeof TONES)[number], string> = {
  blue: 'bg-blue',
  violet: 'bg-violet',
  pink: 'bg-pink',
  orange: 'bg-orange',
  green: 'bg-green',
};

const input =
  'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50';

interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  category: AdminCategory | null;
  onSaved: () => void;
}

export function CategorySheet({ open, onClose, category, onSaved }: CategorySheetProps) {
  const t = useTranslations('menuEditor');
  const tc = useTranslations('menuEditor.category');
  const ta = useTranslations('admin');
  const toast = useToast();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('blue');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setEmoji(category?.emoji ?? '');
    setTone(category?.tone ?? 'blue');
    setDescription(category?.description ?? '');
    setIsActive(category?.isActive ?? true);
    setError(false);
    setConfirmDelete(false);
  }, [open, category]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(true);
      return;
    }
    start(async () => {
      const result = await saveCategory({
        id: category?.id,
        name,
        emoji,
        tone,
        description,
        isActive,
      });
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
      if (!category) return;
      const result = await deleteCategory(category.id);
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
        title={category ? tc('edit') : tc('create')}
        footer={
          <div className="flex items-center gap-3">
            {category ? (
              confirmDelete ? (
                <Button variant="destructive" onClick={remove} loading={pending}>
                  {tc('confirm')}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-5" aria-hidden />
                  {tc('delete')}
                </Button>
              )
            ) : null}
            <Button type="submit" form="admin-category-form" className="ml-auto" loading={pending}>
              {ta('save')}
            </Button>
          </div>
        }
      >
        <form id="admin-category-form" onSubmit={submit} noValidate className="space-y-5 pb-2 pt-3">
          {confirmDelete && category ? (
            <p role="alert" className="rounded-2xl bg-red/10 px-4 py-3 font-medium">
              {tc('confirmDelete', { name: category.name, count: category.products.length })}
            </p>
          ) : null}
          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <div className="space-y-1.5">
              <label htmlFor="c-emoji" className="font-semibold">
                {tc('emoji')}
              </label>
              <input
                id="c-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={8}
                className={cn(input, 'text-center text-[22px]')}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="c-name" className="font-semibold">
                {tc('name')}
              </label>
              <input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tc('namePlaceholder')}
                maxLength={60}
                aria-invalid={error}
                className={cn(input, error && 'ring-2 ring-red/60')}
              />
            </div>
          </div>
          <div>
            <p className="text-[14px] text-fg-muted">{tc('emojiHint')}</p>
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={tc('emoji')}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={emoji === e}
                  aria-label={e}
                  onClick={() => setEmoji(e)}
                  className="flex size-11 items-center justify-center rounded-xl text-[22px] hover:bg-fg/[0.06] aria-pressed:bg-fg/[0.1]"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-semibold">{tc('tone')}</legend>
            <div className="flex gap-2">
              {TONES.map((tn) => (
                <button
                  key={tn}
                  type="button"
                  aria-pressed={tone === tn}
                  aria-label={t(`tones.${tn}`)}
                  onClick={() => setTone(tn)}
                  className={cn(
                    'size-11 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg',
                    TONE_BG[tn],
                  )}
                />
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="c-desc" className="font-semibold">
              {tc('description')}
            </label>
            <input
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              className={input}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-fg/[0.03] px-4 py-2">
            <span className="font-semibold">{tc('visible')}</span>
            <Switch label={tc('visible')} checked={isActive} onChange={setIsActive} />
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
