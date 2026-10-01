'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { switchLocation, switchRestaurant } from '@/app/app/context-actions';
import { cn } from '@/lib/utils';

export interface ShellContext {
  restaurants: { id: string; name: string }[];
  restaurantId: string;
  locations: { id: string; name: string; isActive: boolean }[];
  locationId: string | null;
}

const selectClass =
  'h-11 w-full min-w-0 appearance-none truncate rounded-full bg-fg/[0.06] pl-4 pr-9 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50 disabled:opacity-60';

/**
 * Restaurant et établissement actifs. Un sélecteur n'apparaît que s'il y a le
 * choix ; sinon le nom du restaurant s'affiche simplement.
 */
export function ContextSwitcher({
  context,
  restaurantName,
  className,
}: {
  context: ShellContext;
  restaurantName: string;
  className?: string;
}) {
  const t = useTranslations('admin.context');
  const router = useRouter();
  const [pending, start] = useTransition();
  const many = {
    restaurants: context.restaurants.length > 1,
    locations: context.locations.length > 1,
  };

  const change = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
    });

  return (
    <div className={cn('space-y-2', className)}>
      {many.restaurants ? (
        <div className="relative">
          <select
            aria-label={t('restaurant')}
            value={context.restaurantId}
            disabled={pending}
            onChange={(e) => change(() => switchRestaurant(e.target.value))}
            className={selectClass}
          >
            {context.restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
        </div>
      ) : (
        <p className="truncate font-semibold">{restaurantName}</p>
      )}
      {many.locations && context.locationId ? (
        <div className="relative">
          <select
            aria-label={t('location')}
            value={context.locationId}
            disabled={pending}
            onChange={(e) => change(() => switchLocation(context.restaurantId, e.target.value))}
            className={cn(selectClass, 'font-medium')}
          >
            {context.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.isActive ? l.name : t('inactive', { name: l.name })}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
