import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from '@/lib/env';

/**
 * Client service-role : contourne la RLS. Uniquement pour webhooks, crons et
 * lecture des secrets chiffrés. Jamais importé depuis un composant client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
