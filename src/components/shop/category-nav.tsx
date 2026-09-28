'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { MenuCategory } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

export const categoryAnchor = (id: string) => `cat-${id}`;

/** Barre de catégories collante (Liquid Glass) avec suivi de la section visible. */
export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  const t = useTranslations('shop');
  const [active, setActive] = useState(categories[0]?.id);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(categoryAnchor(c.id)))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        const first = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];
        if (first) setActive(first.target.id.replace(/^cat-/, ''));
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  // Garde la pastille active visible dans la barre défilante.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  if (categories.length < 2) return null;

  return (
    <nav aria-label={t('categories')} className="sticky top-3 z-30 mx-3 sm:mx-auto sm:max-w-3xl">
      <ul
        ref={listRef}
        className="glass flex gap-1 overflow-x-auto rounded-full p-1.5 shadow-float [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => (
          <li key={c.id} data-cat={c.id} className="shrink-0">
            <a
              href={`#${categoryAnchor(c.id)}`}
              aria-current={active === c.id ? 'true' : undefined}
              onClick={() => setActive(c.id)}
              className={cn(
                'flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[15px] font-semibold transition-colors',
                active === c.id ? 'bg-fg text-bg' : 'text-fg hover:bg-fg/[0.06]',
              )}
            >
              {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
