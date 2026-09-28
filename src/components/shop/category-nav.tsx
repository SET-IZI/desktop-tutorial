'use client';

import { useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuCategory } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

export const categoryAnchor = (id: string) => `cat-${id}`;

/** Hauteur réservée à la barre collante (même valeur que `scroll-mt-24` sur les sections). */
const STICKY_OFFSET = 96;
/** Durée max pendant laquelle le suivi est figé après un clic (défilement programmé). */
const LOCK_MS = 1200;

/**
 * Barre de catégories collante (Liquid Glass).
 * - Clic : défilement calculé en JS (pas de saut d'ancre, qui peut être intercepté
 *   dans une iframe) ; la catégorie cliquée reste active pendant le défilement.
 * - Suivi : la dernière section dont le haut a passé la barre.
 * - La pastille active est centrée en ne faisant défiler que la barre elle-même :
 *   `scrollIntoView` interromprait le défilement de la page sur Safari et Chrome.
 */
export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  const t = useTranslations('shop');
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(categories[0]?.id);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const listRef = useRef<HTMLUListElement>(null);
  const lockUntil = useRef(0);

  const computeActive = useCallback(() => {
    if (Date.now() < lockUntil.current) return;
    const line = STICKY_OFFSET + 24;
    let current = categories[0]?.id;
    for (const c of categories) {
      const el = document.getElementById(categoryAnchor(c.id));
      if (el && el.getBoundingClientRect().top <= line) current = c.id;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom && window.scrollY > 0) current = categories[categories.length - 1]?.id;
    setActive(current);
  }, [categories]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(computeActive);
    };
    const onScrollEnd = () => {
      lockUntil.current = 0;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd);
    computeActive();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
    };
  }, [computeActive]);

  // Fondu sur les bords seulement quand il reste des catégories à faire défiler.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () =>
      setOverflow({
        left: list.scrollLeft > 4,
        right: list.scrollLeft + list.clientWidth < list.scrollWidth - 4,
      });
    update();
    list.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [categories]);

  // Centre la pastille active dans la barre, sans toucher au défilement de la page.
  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!list || !pill) return;
    list.scrollTo({
      left: pill.offsetLeft - (list.clientWidth - pill.clientWidth) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [active, reduceMotion]);

  const goTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const section = document.getElementById(categoryAnchor(id));
    if (!section) return;
    setActive(id);
    lockUntil.current = Date.now() + LOCK_MS;
    const top = section.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Accessibilité : le focus suit, sans provoquer un second défilement.
    section.focus({ preventScroll: true });
  };

  if (categories.length < 2) return null;

  const fade = `linear-gradient(to right, ${overflow.left ? 'transparent, black 44px' : 'black'}, ${
    overflow.right ? 'black calc(100% - 44px), transparent' : 'black'
  })`;

  return (
    <nav
      aria-label={t('categories')}
      className="sticky top-[max(1rem,env(safe-area-inset-top))] z-30 -mt-7 flex justify-center px-4"
    >
      {/* Largeur du contenu (centrée) ; défilement horizontal si ça ne tient pas.
          Le fondu est sur la liste interne pour ne pas rogner l'ombre de la pastille. */}
      <div className="glass w-fit max-w-full overflow-hidden rounded-full p-1 shadow-float">
        <ul
          ref={listRef}
          style={{ maskImage: fade, WebkitMaskImage: fade }}
          className="flex gap-0.5 overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c) => (
            <li key={c.id} data-cat={c.id} className="shrink-0">
              <a
                href={`#${categoryAnchor(c.id)}`}
                aria-current={active === c.id ? 'true' : undefined}
                onClick={(e) => goTo(e, c.id)}
                className={cn(
                  'flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[15px] font-semibold transition-colors duration-300',
                  active === c.id ? 'bg-fg text-bg' : 'text-fg hover:bg-fg/[0.06]',
                )}
              >
                {c.emoji ? (
                  <span aria-hidden className="text-[16px]">
                    {c.emoji}
                  </span>
                ) : null}
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
