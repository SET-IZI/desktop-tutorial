import type { Metadata } from 'next';
import { KitchenBoard } from '@/components/kitchen/kitchen-board';
import { ToastProvider } from '@/components/ui/toast';
import { getCurrentLocation } from '@/lib/admin/location';
import { requireRestaurant } from '@/lib/auth/session';
import { loadKitchenOrders } from '@/lib/kitchen/orders';

export const metadata: Metadata = { title: 'Cuisine', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Écran cuisine plein écran (tablette ou ordinateur), hors du shell du back-office. */
export default async function KitchenPage() {
  const { current } = await requireRestaurant();
  const location = await getCurrentLocation(current.restaurantId);
  if (!location) throw new Error('Établissement introuvable');
  const orders = await loadKitchenOrders(location.id);
  return (
    <ToastProvider>
      <KitchenBoard
        orders={orders}
        locationId={location.id}
        locationName={location.name}
        timezone={location.timezone}
      />
    </ToastProvider>
  );
}
