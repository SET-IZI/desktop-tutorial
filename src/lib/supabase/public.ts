import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Client anonyme sans cookies, pour les lectures publiques (boutique).
 * Sans cookies, les pages peuvent être mises en cache (ISR).
 */
export function createPublicClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
