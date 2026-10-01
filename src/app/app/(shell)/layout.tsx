import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentLocation, getLocations } from '@/lib/admin/location';
import { canManage, requireRestaurant } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Back-office', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { current, memberships } = await requireRestaurant();
  const [location, locations] = await Promise.all([
    getCurrentLocation(current.restaurantId),
    getLocations(current.restaurantId),
  ]);
  return (
    <AdminShell
      restaurant={{ name: current.name, slug: current.slug }}
      canManage={canManage(current.role)}
      context={{
        restaurants: memberships.map((m) => ({ id: m.restaurantId, name: m.name })),
        restaurantId: current.restaurantId,
        locations: locations.map((l) => ({ id: l.id, name: l.name, isActive: l.is_active })),
        locationId: location?.id ?? null,
      }}
      rush={
        location ? { mode: location.rush_mode, extraMinutes: location.rush_extra_minutes } : null
      }
    >
      {children}
    </AdminShell>
  );
}
