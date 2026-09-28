'use client';

import { useTranslations } from 'next-intl';
import type { DietTag } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

const TONE: Record<DietTag, string> = {
  vegetarian: 'bg-green/15',
  vegan: 'bg-green/15',
  gluten_free: 'bg-orange/15',
  spicy: 'bg-red/10',
  new: 'bg-violet/15',
};

/** Badges régime (un emoji maximum par badge, cf. CLAUDE.md). */
export function DietBadges({ tags, className }: { tags: DietTag[]; className?: string }) {
  const t = useTranslations('shop.badges');
  if (tags.length === 0) return null;
  // vegan implique végé : on n'affiche pas les deux.
  const shown = tags.includes('vegan') ? tags.filter((x) => x !== 'vegetarian') : tags;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((tag) => (
        <li
          key={tag}
          className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-medium text-fg', TONE[tag])}
        >
          {t(tag)}
        </li>
      ))}
    </ul>
  );
}
