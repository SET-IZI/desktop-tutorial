import { ChevronRight, LogOut, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { signOut } from '@/app/(auth)/actions';
import { PushToggle } from '@/components/admin/push-toggle';
import { SettingsForms } from '@/components/admin/settings-forms';
import { Card } from '@/components/ui/card';
import { getCurrentLocation } from '@/lib/admin/location';
import { canManage, requireRestaurant } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const { current } = await requireRestaurant();
  const t = await getTranslations('admin.settings');
  const ta = await getTranslations('admin');
  const tauth = await getTranslations('auth');
  const [{ data: restaurant }, location] = await Promise.all([
    createClient()
      .from('restaurants')
      .select('id, name, description, accent_color, is_published, logo_url, cover_url')
      .eq('id', current.restaurantId)
      .single(),
    getCurrentLocation(current.restaurantId),
  ]);
  if (!restaurant || !location) throw new Error('Restaurant introuvable');

  return (
    <div className="space-y-6">
      <h1 className="text-display-sm">{t('title')}</h1>
      {/* Mobile : pages hors onglets et déconnexion. */}
      <Card className="p-2 lg:hidden">
        <ul className="divide-y divide-line/[0.06]">
          {canManage(current.role)
            ? (
                [
                  { href: '/app/etablissements', label: ta('nav.locations'), icon: MapPin },
                  { href: '/app/equipe', label: ta('nav.team'), icon: Users },
                ] as const
              ).map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-touch items-center gap-3 rounded-2xl px-3 py-2 font-semibold hover:bg-fg/[0.04]"
                  >
                    <Icon className="size-5 text-fg-muted" aria-hidden />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="size-5 text-fg-muted" aria-hidden />
                  </Link>
                </li>
              ))
            : null}
          <li>
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-touch w-full items-center gap-3 rounded-2xl px-3 py-2 font-semibold hover:bg-fg/[0.04]"
              >
                <LogOut className="size-5 text-fg-muted" aria-hidden />
                {tauth('logout')}
              </button>
            </form>
          </li>
        </ul>
      </Card>
      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
        <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      ) : null}
      <SettingsForms
        canManage={canManage(current.role)}
        restaurant={{
          id: restaurant.id,
          logoUrl: restaurant.logo_url,
          coverUrl: restaurant.cover_url,
          name: restaurant.name,
          description: restaurant.description ?? '',
          accentColor: restaurant.accent_color,
          isPublished: restaurant.is_published,
        }}
        location={{
          name: location.name,
          phone: location.phone ?? '',
          address: `${location.address_line}, ${location.postal_code} ${location.city}`,
          pickupEnabled: location.pickup_enabled,
          onSitePaymentEnabled: location.on_site_payment_enabled,
          prepTimeMinutes: location.prep_time_minutes,
          slotIntervalMinutes: location.slot_interval_minutes,
          slotCapacity: location.slot_capacity,
          rushExtraMinutes: location.rush_extra_minutes,
        }}
      />
    </div>
  );
}
