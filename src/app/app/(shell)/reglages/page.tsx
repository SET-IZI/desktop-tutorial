import { getTranslations } from 'next-intl/server';
import { SettingsForms } from '@/components/admin/settings-forms';
import { getCurrentLocation } from '@/lib/admin/location';
import { canManage, requireRestaurant } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const { current } = await requireRestaurant();
  const t = await getTranslations('admin.settings');
  const [{ data: restaurant }, location] = await Promise.all([
    createClient()
      .from('restaurants')
      .select('name, description, accent_color, is_published')
      .eq('id', current.restaurantId)
      .single(),
    getCurrentLocation(current.restaurantId),
  ]);
  if (!restaurant || !location) throw new Error('Restaurant introuvable');

  return (
    <div className="space-y-6">
      <h1 className="text-display-sm">{t('title')}</h1>
      <SettingsForms
        canManage={canManage(current.role)}
        restaurant={{
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
