import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Admin = SupabaseClient<Database>;

/** Paiement réussi : la commande passe en « new » (idempotent, montant vérifié en base). */
export async function handlePaymentSucceeded(admin: Admin, intentId: string, amountCents: number) {
  const { data, error } = await admin.rpc('mark_order_paid', {
    p_payment_intent: intentId,
    p_amount_cents: amountCents,
  });
  if (error) throw new Error(`mark_order_paid : ${error.message}`);
  return data; // id de la commande, ou null si déjà traitée
}

/** Paiement refusé : la commande reste en attente, le client peut réessayer. */
export async function handlePaymentFailed(admin: Admin, intentId: string) {
  const { error } = await admin
    .from('orders')
    .update({ payment_status: 'failed' })
    .eq('stripe_payment_intent_id', intentId)
    .eq('status', 'pending_payment');
  if (error) throw new Error(`payment_failed : ${error.message}`);
}

/** Compte connecté mis à jour : peut-il encaisser ? */
export async function handleAccountUpdated(
  admin: Admin,
  accountId: string,
  chargesEnabled: boolean,
) {
  const { error } = await admin
    .from('restaurants')
    .update({ stripe_charges_enabled: chargesEnabled })
    .eq('stripe_account_id', accountId);
  if (error) throw new Error(`account.updated : ${error.message}`);
}
