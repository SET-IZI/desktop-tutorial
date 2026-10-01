import 'server-only';
import { getPublicEnv } from '@/lib/env';
import { formatPrice } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from './email';
import { pushToRestaurant } from './push';
import {
  orderCancelledEmail,
  orderPlacedEmail,
  orderReadyEmail,
  type Locale,
  type OrderEmailData,
} from './templates';

/**
 * Notifications d'une commande : email au client (s'il a laissé son adresse),
 * push à l'équipe pour une nouvelle commande. Appelées après coup, jamais
 * bloquantes (les envois ne lèvent pas).
 */

const REASONS: Record<Locale, Record<string, (restaurant: string) => string>> = {
  fr: {
    sold_out: (r) => `${r} n'a plus un des plats de ta commande.`,
    too_busy: (r) => `La cuisine de ${r} est débordée pour le moment.`,
    closed: (r) => `${r} est fermé pour le moment.`,
  },
  en: {
    sold_out: (r) => `${r} ran out of one of the dishes in your order.`,
    too_busy: (r) => `${r}'s kitchen is too busy right now.`,
    closed: (r) => `${r} is closed right now.`,
  },
};

async function loadOrder(orderId: string) {
  const { data, error } = await createAdminClient()
    .from('orders')
    .select(
      `id, number, status, public_token, locale, customer_name, customer_email, scheduled_for,
       extra_minutes, total_cents, payment_status, cancel_reason, restaurant_id,
       locations ( address_line, postal_code, city, timezone, restaurants ( slug, name, currency ) )`,
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const restaurant = data?.locations?.restaurants;
  if (!data || !data.locations || !restaurant) return null;

  const locale: Locale = data.locale === 'en' ? 'en' : 'fr';
  const intl = locale === 'en' ? 'en-GB' : 'fr-FR';
  const due = data.scheduled_for
    ? new Date(new Date(data.scheduled_for).getTime() + data.extra_minutes * 60_000)
    : null;
  const when = due
    ? new Intl.DateTimeFormat(intl, {
        timeZone: data.locations.timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(due)
    : null;
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const email: OrderEmailData = {
    locale,
    number: data.number,
    restaurantName: restaurant.name,
    customerName: data.customer_name,
    trackingUrl: `${base}/s/${restaurant.slug}/commande/${data.public_token}`,
    when,
    address: `${data.locations.address_line}, ${data.locations.postal_code} ${data.locations.city}`,
    total: formatPrice(data.total_cents, restaurant.currency, intl),
    paid: data.payment_status === 'paid',
  };
  return { order: data, restaurant, email, time: when };
}

/** Nouvelle commande (paiement sur place, ou paiement en ligne confirmé). */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    const loaded = await loadOrder(orderId);
    if (!loaded || loaded.order.status !== 'new') return;
    const { order, email } = loaded;
    await Promise.all([
      order.customer_email
        ? sendEmail({
            to: order.customer_email,
            ...orderPlacedEmail(email),
            idempotencyKey: `order-placed-${order.id}`,
          })
        : Promise.resolve(false),
      pushToRestaurant(order.restaurant_id, {
        title: `Nouvelle commande n°${order.number}`,
        body: `${order.customer_name} · ${email.total}${loaded.time ? ` · ${loaded.time}` : ''}`,
        url: '/app/cuisine',
        tag: `order-${order.id}`,
      }),
    ]);
  } catch (error) {
    console.error('[notify]', error);
  }
}

/** Commande prête ou annulée par le restaurant : le client est prévenu. */
export async function notifyOrderStatus(orderId: string): Promise<void> {
  try {
    const loaded = await loadOrder(orderId);
    if (!loaded?.order.customer_email) return;
    const { order, email, restaurant } = loaded;
    if (order.status === 'ready') {
      await sendEmail({
        to: order.customer_email!,
        ...orderReadyEmail(email),
        idempotencyKey: `order-ready-${order.id}`,
      });
    } else if (order.status === 'rejected' || order.status === 'cancelled') {
      const reason = order.cancel_reason ? REASONS[email.locale][order.cancel_reason] : undefined;
      await sendEmail({
        to: order.customer_email!,
        ...orderCancelledEmail({
          ...email,
          reason: reason ? reason(restaurant.name) : null,
          refunded: order.payment_status === 'refunded',
        }),
        idempotencyKey: `order-cancelled-${order.id}`,
      });
    }
  } catch (error) {
    console.error('[notify]', error);
  }
}
