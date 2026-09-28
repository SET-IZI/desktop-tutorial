'use client';

import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { isOpenAt } from '@/lib/slots/compute';
import type { Storefront } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

export function StoreHeader({ storefront }: { storefront: Storefront }) {
  const t = useTranslations('shop');
  const { restaurant, location } = storefront;
  // Dépend de l'heure du client : calculé après le montage (pas d'écart SSR).
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const services = location.pickupEnabled ? 'pickup' : 'delivery';
    const update = () =>
      setOpen(
        isOpenAt(new Date(), {
          timezone: location.timezone,
          closures: location.closures,
          hours: location.hours.filter((h) => h.service === services),
        }),
      );
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [location]);

  return (
    <header className="relative overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pt-16">
      <MeshGradient colors={['orange', 'pink', 'violet']} />
      <div className="relative mx-auto max-w-3xl">
        <div className="flex items-center gap-4">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo de petite taille, déjà optimisé à l'upload
            <img
              src={restaurant.logoUrl}
              alt=""
              className="size-16 rounded-bento-sm object-cover shadow-soft"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-bento-sm bg-accent font-rounded text-[30px] font-extrabold text-accent-fg shadow-soft"
            >
              {restaurant.name.charAt(0)}
            </span>
          )}
          {open !== null ? (
            <span
              className={cn(
                'glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[14px] font-semibold',
              )}
            >
              <span
                aria-hidden
                className={cn('size-2 rounded-full', open ? 'bg-green' : 'bg-fg/40')}
              />
              {open ? t('open') : t('closedPreorder')}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 text-balance text-display-sm sm:text-display-md">{restaurant.name}</h1>
        {restaurant.description ? (
          <p className="mt-2 max-w-xl text-[17px] text-fg">{restaurant.description}</p>
        ) : null}
        <p className="mt-3 flex items-center gap-1.5 text-[15px] text-fg">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {location.addressLine}, {location.postalCode} {location.city}
        </p>
      </div>
    </header>
  );
}
