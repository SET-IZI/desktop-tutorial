'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertRole } from '@/lib/auth/session';
import { refundOrderPayment } from '@/lib/payments/gateway';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notifyOrderStatus } from '@/lib/notify/orders';

/**
 * Actions de l'écran cuisine (toute l'équipe, rôle cuisine compris). Écritures
 * via le client de l'utilisateur : la RLS et les privilèges par colonne
 * (status, extra_minutes, cancel_reason) font foi ; le trigger orders_lifecycle
 * refuse toute transition interdite et horodate chaque étape.
 */

export type KitchenResult = { ok: true } | { ok: false; error: string };

const REJECT_REASONS = ['sold_out', 'too_busy', 'closed', 'other'] as const;

const statusSchema = z.object({
  orderId: z.uuid(),
  to: z.enum(['accepted', 'preparing', 'ready', 'completed']),
});

async function guard(fn: () => Promise<KitchenResult>): Promise<KitchenResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    console.error('[kitchen]', error);
    return { ok: false, error: 'server_error' };
  }
}

export async function setOrderStatus(input: z.input<typeof statusSchema>): Promise<KitchenResult> {
  return guard(async () => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    await assertRole(['owner', 'manager', 'kitchen']);
    const { data, error } = await createClient()
      .from('orders')
      .update({ status: parsed.data.to })
      .eq('id', parsed.data.orderId)
      .select('id');
    if (error) {
      // Déjà modifiée par quelqu'un d'autre (autre écran) : transition refusée.
      if (error.message.includes('Transition')) return { ok: false, error: 'stale' };
      throw new Error(error.message);
    }
    if (data.length === 0) return { ok: false, error: 'not_found' };
    if (parsed.data.to === 'ready') await notifyOrderStatus(parsed.data.orderId);
    revalidatePath('/app', 'layout');
    return { ok: true };
  });
}

const delaySchema = z.object({ orderId: z.uuid(), minutes: z.number().int().min(5).max(60) });

/** Retard annoncé au client (« +10 min »), cumulé sur la commande. */
export async function delayOrder(input: z.input<typeof delaySchema>): Promise<KitchenResult> {
  return guard(async () => {
    const parsed = delaySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    await assertRole(['owner', 'manager', 'kitchen']);
    const supabase = createClient();
    const { data: order, error: readError } = await supabase
      .from('orders')
      .select('extra_minutes')
      .eq('id', parsed.data.orderId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!order) return { ok: false, error: 'not_found' };
    const { error } = await supabase
      .from('orders')
      .update({ extra_minutes: Math.min(240, order.extra_minutes + parsed.data.minutes) })
      .eq('id', parsed.data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}

const rejectSchema = z.object({ orderId: z.uuid(), reason: z.enum(REJECT_REASONS) });

/**
 * Refus (commande nouvelle) ou annulation (commande acceptée). Une commande déjà
 * payée par carte est remboursée intégralement, sur le compte du restaurant.
 */
export async function rejectOrder(input: z.input<typeof rejectSchema>): Promise<KitchenResult> {
  return guard(async () => {
    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    await assertRole(['owner', 'manager', 'kitchen']);
    const supabase = createClient();
    const { data: order, error: readError } = await supabase
      .from('orders')
      .select('id, status, payment_method, payment_status, stripe_payment_intent_id, restaurant_id')
      .eq('id', parsed.data.orderId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!order) return { ok: false, error: 'not_found' };
    if (!['new', 'accepted', 'preparing', 'ready'].includes(order.status)) {
      return { ok: false, error: 'stale' };
    }

    const { error } = await supabase
      .from('orders')
      .update({
        status: order.status === 'new' ? 'rejected' : 'cancelled',
        cancel_reason: parsed.data.reason,
      })
      .eq('id', order.id);
    if (error) {
      if (error.message.includes('Transition')) return { ok: false, error: 'stale' };
      throw new Error(error.message);
    }

    if (
      order.payment_method === 'card' &&
      order.payment_status === 'paid' &&
      order.stripe_payment_intent_id
    ) {
      // Le statut de paiement est réservé au serveur (service role).
      const admin = createAdminClient();
      const { data: restaurant } = await admin
        .from('restaurants')
        .select('stripe_account_id')
        .eq('id', order.restaurant_id)
        .single();
      await refundOrderPayment({
        intentId: order.stripe_payment_intent_id,
        accountId: restaurant?.stripe_account_id ?? null,
        orderId: order.id,
      });
      await admin.from('orders').update({ payment_status: 'refunded' }).eq('id', order.id);
    }
    await notifyOrderStatus(order.id);
    revalidatePath('/app', 'layout');
    return { ok: true };
  });
}
