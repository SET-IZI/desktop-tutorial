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
interface DietBadgesProps {
  tags: DietTag[];
  className?: string;
  /** Sur une ligne, limité à `max` badges (cartes de hauteur fixe). */
  compact?: boolean;
  max?: number;
}

export function DietBadges({ tags, className, compact = false, max = 2 }: DietBadgesProps) {
  const t = useTranslations('shop.badges');
  if (tags.length === 0) return null;
  // vegan implique végé : on n'affiche pas les deux.
  const all = tags.includes('vegan') ? tags.filter((x) => x !== 'vegetarian') : tags;
  const shown = compact ? all.slice(0, max) : all;
  return (
    <ul
      className={cn(
        'flex gap-1.5',
        // Compact : un badge qui ne tient pas passe à la ligne, masquée (jamais coupé en deux).
        compact ? 'h-[26px] min-w-0 flex-wrap overflow-hidden' : 'flex-wrap',
        className,
      )}
    >
      {shown.map((tag) => (
        <li
          key={tag}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium text-fg',
            TONE[tag],
          )}
        >
          {t(tag)}
        </li>
      ))}
    </ul>
  );
}
