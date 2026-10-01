'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { isOpenAt } from '@/lib/slots/compute';
import { LOCATION_PARAM } from '@/lib/storefront/location';
import type { Storefront } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

export function StoreHeader({ storefront }: { storefront: Storefront }) {
  const t = useTranslations('shop');
  const { restaurant, location } = storefront;
  // Parallaxe douce : le contenu glisse et s'estompe, le dégradé s'agrandit.
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const contentY = useTransform(scrollY, [0, 320], [0, 70]);
  const contentOpacity = useTransform(scrollY, [0, 260], [1, 0.25]);
  const meshScale = useTransform(scrollY, [0, 320], [1, 1.18]);

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
    <header className="relative overflow-hidden px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={reduce ? undefined : { scale: meshScale }}
      >
        <MeshGradient colors={['orange', 'pink', 'violet']} />
      </motion.div>
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10" />
      <motion.div
        className="relative mx-auto max-w-3xl"
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
      >
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
                'glass inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold',
              )}
            >
              <span aria-hidden className="relative flex size-2.5">
                {open ? (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-60" />
                ) : null}
                <span
                  className={cn(
                    'relative inline-flex size-2.5 rounded-full',
                    open ? 'bg-green' : 'bg-red',
                  )}
                />
              </span>
              {open ? t('open') : t('closedPreorder')}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 text-balance text-display-sm sm:text-display-md">{restaurant.name}</h1>
        {restaurant.description ? (
          <p className="mt-2 max-w-xl text-[17px] text-fg">{restaurant.description}</p>
        ) : null}
        {storefront.locations.length > 1 ? (
          <nav aria-label={t('locations')} className="mt-4">
            <ul className="flex flex-wrap gap-2">
              {storefront.locations.map((l) => {
                const current = l.id === location.id;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/s/${restaurant.slug}?${LOCATION_PARAM}=${l.id}`}
                      replace
                      scroll={false}
                      aria-current={current ? 'true' : undefined}
                      className={cn(
                        'inline-flex min-h-touch items-center rounded-full px-4 text-[15px] font-semibold text-fg transition-colors',
                        current ? 'bg-surface shadow-soft' : 'glass',
                      )}
                    >
                      {l.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
        <p className="mt-3 flex items-center gap-1.5 text-[15px] text-fg">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {location.addressLine}, {location.postalCode} {location.city}
        </p>
      </motion.div>
    </header>
  );
}
