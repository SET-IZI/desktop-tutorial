import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPaymentsEnv } from '@/lib/env';
import { handlePaymentSucceeded } from '@/lib/payments/handlers';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOrderPlaced } from '@/lib/notify/orders';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ token: z.string().min(16).max(64) });

/**
 * Paiement SIMULÉ (dev et E2E uniquement) : joue le même traitement que le webhook
 * `payment_intent.succeeded`. Renvoie 404 dès que Stripe est configuré.
 */
export async function POST(request: Request) {
  if (getPaymentsEnv().mode !== 'mock')
    return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('stripe_payment_intent_id, total_cents')
    .eq('public_token', parsed.data.token)
    .maybeSingle();
  if (!order?.stripe_payment_intent_id?.startsWith('pi_mock_')) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const orderId = await handlePaymentSucceeded(
    admin,
    order.stripe_payment_intent_id,
    order.total_cents,
  );
  if (orderId) await notifyOrderPlaced(orderId);
  return NextResponse.json({ ok: true });
}
