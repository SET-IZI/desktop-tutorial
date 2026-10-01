import 'server-only';
import webpush from 'web-push';
import { getPushEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeOutbox } from './outbox';

export interface PushMessage {
  title: string;
  body: string;
  /** Page ouverte au clic sur la notification. */
  url: string;
  /** Une notification remplace la précédente de même tag (pas d'empilement). */
  tag: string;
}

/**
 * Notifie tous les appareils de l'équipe d'un restaurant. Les abonnements
 * expirés (404 / 410) sont supprimés. Ne lève jamais.
 */
export async function pushToRestaurant(
  restaurantId: string,
  message: PushMessage,
): Promise<number> {
  try {
    const env = getPushEnv();
    if (env.mode === 'off') return 0;
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('restaurant_id', restaurantId);
    if (error) throw new Error(error.message);

    if (env.mode === 'mock') {
      await writeOutbox('push', { restaurantId, devices: subs.length, ...message });
      return subs.length;
    }

    webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
    const payload = JSON.stringify(message);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 15, urgency: 'high' },
        ),
      ),
    );
    const expired = subs.filter((s, i) => {
      const r = results[i];
      return (
        r?.status === 'rejected' &&
        r.reason instanceof webpush.WebPushError &&
        (r.reason.statusCode === 404 || r.reason.statusCode === 410)
      );
    });
    if (expired.length > 0) {
      await admin
        .from('push_subscriptions')
        .delete()
        .in(
          'id',
          expired.map((s) => s.id),
        );
    }
    return results.filter((r) => r.status === 'fulfilled').length;
  } catch (error) {
    console.error('[push]', error);
    return 0;
  }
}
