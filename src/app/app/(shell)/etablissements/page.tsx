import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LocationsManager } from '@/components/admin/locations-manager';
import { getCurrentLocation, getLocations } from '@/lib/admin/location';
import { canManage, requireRestaurant } from '@/lib/auth/session';

export default async function LocationsPage() {
  const { current } = await requireRestaurant();
  if (!canManage(current.role)) redirect('/app');
  const t = await getTranslations('admin.locations');
  const [locations, active] = await Promise.all([
    getLocations(current.restaurantId),
    getCurrentLocation(current.restaurantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm">{t('title')}</h1>
        <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
      </div>
      <LocationsManager
        restaurantId={current.restaurantId}
        currentId={active?.id ?? null}
        locations={locations.map((l) => ({
          id: l.id,
          name: l.name,
          address: `${l.address_line}, ${l.postal_code} ${l.city}`,
          isActive: l.is_active,
        }))}
      />
    </div>
  );
}
