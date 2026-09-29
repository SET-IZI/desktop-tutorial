import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Établissement courant du restaurant (le plus ancien ; sélection en 4d). */
export const getCurrentLocation = cache(async (restaurantId: string) => {
  const { data, error } = await createClient()
    .from('locations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`locations : ${error.message}`);
  return data;
});
