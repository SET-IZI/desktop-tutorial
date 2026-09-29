import { getTranslations } from 'next-intl/server';
import { HoursEditor } from '@/components/admin/hours-editor';
import { getCurrentLocation } from '@/lib/admin/location';
import { scheduleFromRows } from '@/lib/admin/schedule';
import { canManage, requireRestaurant } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function HoursPage() {
  const { current } = await requireRestaurant();
  const t = await getTranslations('admin.hours');
  const location = await getCurrentLocation(current.restaurantId);
  if (!location) throw new Error('Établissement introuvable');
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: hours }, { data: closures }] = await Promise.all([
    supabase
      .from('opening_hours')
      .select('service, weekday, opens_at, closes_at')
      .eq('location_id', location.id),
    supabase
      .from('location_closures')
      .select('id, starts_on, ends_on, reason')
      .eq('location_id', location.id)
      .gte('ends_on', today)
      .order('starts_on'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm">{t('title')}</h1>
        <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
      </div>
      <HoursEditor
        canManage={canManage(current.role)}
        deliveryEnabled={location.delivery_enabled}
        schedules={{
          pickup: scheduleFromRows((hours ?? []).filter((h) => h.service === 'pickup')),
          delivery: scheduleFromRows((hours ?? []).filter((h) => h.service === 'delivery')),
        }}
        closures={(closures ?? []).map((c) => ({
          id: c.id,
          startsOn: c.starts_on,
          endsOn: c.ends_on,
          reason: c.reason,
        }))}
      />
    </div>
  );
}
