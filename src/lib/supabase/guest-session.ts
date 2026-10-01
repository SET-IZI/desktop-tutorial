import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checkout invité : une session Supabase anonyme (sans compte ni formulaire)
 * relie la commande au navigateur. La RLS (`customer_user_id = auth.uid()`)
 * permet alors de suivre la commande en temps réel. Un échec n'empêche jamais
 * de commander : le suivi retombe sur le rafraîchissement périodique.
 */
export async function ensureGuestSession(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    await supabase.auth.signInAnonymously();
  } catch {
    // Pas de session : la commande reste possible.
  }
}
