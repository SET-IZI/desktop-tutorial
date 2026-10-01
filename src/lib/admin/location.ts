import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Établissement actif dans le back-office (multi-établissements). */
export const LOCATION_COOKIE = 'miaamm_location';

/** Établissements du restaurant, du plus ancien au plus récent. */
export const getLocations = cache(async (restaurantId: string) => {
  const { data, error } = await createClient()
    .from('locations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at');
  if (error) throw new Error(`locations : ${error.message}`);
  return data;
});

/**
 * Établissement courant : celui du cookie s'il appartient au restaurant,
 * sinon le plus ancien (actif de préférence).
 */
export const getCurrentLocation = cache(async (restaurantId: string) => {
  const locations = await getLocations(restaurantId);
  const wanted = cookies().get(LOCATION_COOKIE)?.value;
  return (
    locations.find((l) => l.id === wanted) ??
    locations.find((l) => l.is_active) ??
    locations[0] ??
    null
  );
});
