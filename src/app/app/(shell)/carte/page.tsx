import { MenuEditor } from '@/components/admin/menu/menu-editor';
import { getCurrentLocation } from '@/lib/admin/location';
import { loadAdminMenu } from '@/lib/admin/menu';
import { canManage, requireRestaurant } from '@/lib/auth/session';

export default async function MenuPage() {
  const { current } = await requireRestaurant();
  const location = await getCurrentLocation(current.restaurantId);
  const categories = location?.menu_id ? await loadAdminMenu(location.menu_id) : [];
  return (
    <MenuEditor
      categories={categories}
      restaurantId={current.restaurantId}
      canManage={canManage(current.role)}
    />
  );
}
