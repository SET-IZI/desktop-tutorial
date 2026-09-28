import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { fetchStorefront } from './fetch';
import type { Storefront } from './types';

/** Tag de cache : à invalider (revalidateTag) quand la carte ou les réglages changent. */
export const storefrontTag = (slug: string) => `storefront:${slug}`;

/** Boutique en cache 60 s (ISR), invalidée par tag à chaque modification du restaurateur. */
export function getStorefront(slug: string): Promise<Storefront | null> {
  return unstable_cache(() => fetchStorefront(createPublicClient(), slug), ['storefront', slug], {
    revalidate: 60,
    tags: [storefrontTag(slug)],
  })();
}

/** Charge temps réel et surcharges des créneaux : jamais en cache. */
export async function getSlotInputs(locationId: string, from: Date, to: Date) {
  const supabase = createPublicClient();
  const [load, overrides] = await Promise.all([
    supabase.rpc('slot_load', {
      p_location_id: locationId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
    supabase
      .from('time_slots')
      .select('starts_at, capacity, is_blocked')
      .eq('location_id', locationId)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString()),
  ]);
  if (load.error) throw new Error(`slot_load : ${load.error.message}`);
  if (overrides.error) throw new Error(`time_slots : ${overrides.error.message}`);
  return {
    load: load.data.map((l) => ({ startsAt: l.slot_start, count: l.orders_count })),
    overrides: overrides.data.map((o) => ({
      startsAt: o.starts_at,
      capacity: o.capacity,
      isBlocked: o.is_blocked,
    })),
  };
}
