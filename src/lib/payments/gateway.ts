import 'server-only';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { getPaymentsEnv } from '@/lib/env';

/**
 * Passerelle de paiement. Stripe Connect en « direct charges » : le paiement est
 * créé sur le compte Stripe du restaurateur (stripeContext) et l'argent lui revient
 * directement. Aucun `application_fee_amount` : Miaamm ne prend aucune commission.
 */

export interface CreateIntentInput {
  amountCents: number;
  currency: string;
  /** Compte Stripe connecté du restaurant (acct_…). */
  accountId: string | null;
  orderId: string;
  orderNumber: number;
  restaurantId: string;
  restaurantName: string;
}

export type IntentResult =
  | {
      mode: 'stripe';
      intentId: string;
      clientSecret: string;
      stripeAccount: string;
      publishableKey: string;
    }
  | { mode: 'mock'; intentId: string };

/** Montant minimum accepté par Stripe en EUR (0,50 €). */
export const MIN_CARD_AMOUNT_CENTS = 50;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const env = getPaymentsEnv();
  if (env.mode !== 'stripe') throw new Error('Stripe non configuré (mode de paiement simulé).');
  stripeClient ??= new Stripe(env.secretKey, { appInfo: { name: 'Miaamm' } });
  return stripeClient;
}

/** Paiement par carte possible pour ce restaurant ? */
export function cardPaymentsAvailable(restaurant: {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}) {
  const env = getPaymentsEnv();
  if (env.mode === 'mock') return true;
  return Boolean(restaurant.stripeAccountId && restaurant.stripeChargesEnabled);
}

export async function createPaymentIntent(input: CreateIntentInput): Promise<IntentResult> {
  const env = getPaymentsEnv();
  if (env.mode === 'mock') {
    return { mode: 'mock', intentId: `pi_mock_${randomUUID().replace(/-/g, '')}` };
  }
  if (!input.accountId) throw new Error('Restaurant sans compte Stripe connecté.');

  const intent = await getStripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      // Carte, Apple Pay, Google Pay… selon ce que le restaurateur a activé.
      automatic_payment_methods: { enabled: true },
      description: `Commande n°${input.orderNumber} · ${input.restaurantName}`,
      metadata: { order_id: input.orderId, restaurant_id: input.restaurantId },
    },
    // Une seule intention de paiement par commande, même si la requête est rejouée.
    { stripeContext: input.accountId, idempotencyKey: `order-${input.orderId}` },
  );
  if (!intent.client_secret) throw new Error('PaymentIntent sans client_secret.');
  return {
    mode: 'stripe',
    intentId: intent.id,
    clientSecret: intent.client_secret,
    stripeAccount: input.accountId,
    publishableKey: env.publishableKey,
  };
}
