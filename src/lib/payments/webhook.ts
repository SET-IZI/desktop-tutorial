import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/types/database';
import { handleAccountUpdated, handlePaymentFailed, handlePaymentSucceeded } from './handlers';

type Admin = SupabaseClient<Database>;

/**
 * Traite un événement Stripe déjà vérifié (signature contrôlée par l'appelant).
 * Idempotent : chaque event.id n'est traité qu'une fois (table stripe_events).
 * Renvoie 'duplicate' si l'événement avait déjà été reçu.
 */
export async function processStripeEvent(
  admin: Admin,
  event: Stripe.Event,
): Promise<'processed' | 'duplicate' | 'ignored'> {
  const { error: insertError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, account: event.account ?? null });
  if (insertError) {
    // 23505 : déjà reçu (Stripe rejoue les webhooks en cas de doute).
    if (insertError.code === '23505') return 'duplicate';
    throw new Error(`stripe_events : ${insertError.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        await handlePaymentSucceeded(admin, intent.id, intent.amount_received || intent.amount);
        return 'processed';
      }
      case 'payment_intent.payment_failed': {
        await handlePaymentFailed(admin, event.data.object.id);
        return 'processed';
      }
      case 'account.updated': {
        const account = event.data.object;
        await handleAccountUpdated(admin, account.id, account.charges_enabled);
        return 'processed';
      }
      default:
        return 'ignored';
    }
  } catch (error) {
    // Échec du traitement : on oublie l'événement pour que le rejeu de Stripe le retraite.
    await admin.from('stripe_events').delete().eq('id', event.id);
    throw error;
  }
}
