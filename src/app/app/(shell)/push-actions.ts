'use server';

import { z } from 'zod';
import { assertRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/** Abonnement Web Push de cet appareil (toute l'équipe, RLS : les siens uniquement). */

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(
  input: z.input<typeof subscriptionSchema>,
): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const { current } = await assertRole(['owner', 'manager', 'kitchen']);
    const supabase = createClient();
    // Même appareil réabonné : on remplace l'ancien enregistrement.
    await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
    const { error } = await supabase.from('push_subscriptions').insert({
      restaurant_id: current.restaurantId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    console.error('[push]', error);
    return { ok: false };
  }
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  if (!z.url().safeParse(endpoint).success) return { ok: false };
  const { error } = await createClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  return { ok: !error };
}
