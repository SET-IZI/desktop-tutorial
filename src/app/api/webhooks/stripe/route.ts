import { NextResponse } from 'next/server';
import { getPaymentsEnv } from '@/lib/env';
import { getStripe } from '@/lib/payments/gateway';
import { processStripeEvent } from '@/lib/payments/webhook';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe (endpoint « Connect » : événements des comptes connectés).
 * La signature est vérifiée sur le corps brut avant tout traitement.
 */
export async function POST(request: Request) {
  const env = getPaymentsEnv();
  if (env.mode !== 'stripe') {
    return NextResponse.json({ error: 'stripe_disabled' }, { status: 404 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env.webhookSecret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(createAdminClient(), event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error('[stripe webhook]', event.type, event.id, error);
    // 500 : Stripe réessaiera plus tard.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
