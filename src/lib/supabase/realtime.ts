import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Donne le JWT de la session à Realtime avant tout abonnement. Sans cela, une
 * session restaurée depuis les cookies rejoint le canal en anonyme : la RLS
 * filtre alors tous les événements.
 */
export async function authorizeRealtime(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token ?? null);
}
