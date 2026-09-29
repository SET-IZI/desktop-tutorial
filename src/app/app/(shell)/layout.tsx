import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentLocation } from '@/lib/admin/location';
import { canManage, requireRestaurant } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Back-office', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { current } = await requireRestaurant();
  const location = await getCurrentLocation(current.restaurantId);
  return (
    <AdminShell
      restaurant={{ name: current.name, slug: current.slug }}
      canManage={canManage(current.role)}
      rush={
        location ? { mode: location.rush_mode, extraMinutes: location.rush_extra_minutes } : null
      }
    >
      {children}
    </AdminShell>
  );
}
