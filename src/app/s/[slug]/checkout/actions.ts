'use server';

import { computeSlots } from '@/lib/slots/compute';
import { priceOrder } from '@/lib/checkout/price';
import { checkoutSchema, type CheckoutErrorCode, type CheckoutInput } from '@/lib/checkout/schema';
import {
  cardPaymentsAvailable,
  createPaymentIntent,
  MIN_CARD_AMOUNT_CENTS,
  type IntentResult,
} from '@/lib/payments/gateway';
import { fetchStorefront } from '@/lib/storefront/fetch';
import { getSlotInputs } from '@/lib/storefront/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { withLocation } from '@/lib/storefront/location';
import { notifyOrderPlaced } from '@/lib/notify/orders';

export type PlaceOrderResult =
  | {
      ok: true;
      token: string;
      number: number;
      /** null : paiement sur place, rien à payer maintenant. */
      payment: IntentResult | null;
    }
  | { ok: false; error: CheckoutErrorCode; productName?: string };

const SLOT_ERRORS: Record<string, CheckoutErrorCode> = {
  slot_full: 'slot_full',
  slot_unavailable: 'slot_unavailable',
};

/**
 * Crée la commande. Tout est revérifié ici : carte et prix du jour, service ouvert,
 * créneau réellement disponible, moyen de paiement autorisé. La base revérifie la
 * capacité sous verrou (place_order) pour éviter la surréservation.
 */
export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const data = parsed.data;

  try {
    const shop = await fetchStorefront(createPublicClient(), data.slug);
    if (!shop) return { ok: false, error: 'not_found' };
    const storefront = withLocation(shop, data.locationId);
    const { restaurant, location, categories } = storefront;

    // La livraison (adresse, zone, frais) arrive en phase 6.
    if (data.fulfillment === 'delivery') return { ok: false, error: 'delivery_unavailable' };
    if (!location.pickupEnabled) return { ok: false, error: 'service_disabled' };

    const priced = priceOrder(categories, data.lines);
    if (!priced.ok)
      return { ok: false, error: 'product_unavailable', productName: priced.productName };

    // Le créneau doit être proposé et libre au moment de la commande.
    const now = new Date();
    const { load, overrides } = await getSlotInputs(
      location.id,
      now,
      new Date(now.getTime() + 4 * 86_400_000),
    );
    const slots = computeSlots({
      now,
      load,
      overrides,
      days: 3,
      config: {
        timezone: location.timezone,
        prepTimeMinutes: location.prepTimeMinutes,
        slotIntervalMinutes: location.slotIntervalMinutes,
        slotCapacity: location.slotCapacity,
        rushMode: location.rushMode,
        rushExtraMinutes: location.rushExtraMinutes,
        hours: location.hours.filter((h) => h.service === data.fulfillment),
        closures: location.closures,
      },
    });
    if (slots.paused) return { ok: false, error: 'paused' };
    const slotTime = new Date(data.slot).getTime();
    const slot = slots.days
      .flatMap((d) => d.slots)
      .find((s) => new Date(s.startsAt).getTime() === slotTime);
    if (!slot || slot.status !== 'available') {
      return { ok: false, error: slot?.status === 'full' ? 'slot_full' : 'slot_unavailable' };
    }

    const total = priced.subtotalCents;
    if (data.paymentMethod === 'on_site' && !location.onSitePaymentEnabled) {
      return { ok: false, error: 'payment_unavailable' };
    }
    if (data.paymentMethod === 'card') {
      if (!cardPaymentsAvailable(restaurant)) return { ok: false, error: 'payment_unavailable' };
      if (total < MIN_CARD_AMOUNT_CENTS) return { ok: false, error: 'amount_too_low' };
    }

    // Session du navigateur (anonyme pour un invité) : suivi en temps réel via la RLS.
    const { data: auth } = await createClient().auth.getUser();

    const admin = createAdminClient();
    const { data: rows, error } = await admin.rpc('place_order', {
      p: {
        restaurant_id: restaurant.id,
        customer_user_id: auth.user?.id ?? null,
        location_id: location.id,
        fulfillment: data.fulfillment,
        scheduled_for: slot.startsAt,
        status: data.paymentMethod === 'card' ? 'pending_payment' : 'new',
        payment_method: data.paymentMethod,
        payment_status: data.paymentMethod === 'card' ? 'pending' : 'unpaid',
        customer_name: data.customer.firstName,
        customer_phone: data.customer.phone ?? null,
        customer_email: data.customer.email ?? null,
        marketing_opt_in: data.customer.marketingOptIn,
        notes: data.notes ?? null,
        locale: data.locale,
        subtotal_cents: priced.subtotalCents,
        total_cents: total,
        items: priced.items,
      },
    });
    if (error) {
      const code = Object.keys(SLOT_ERRORS).find((k) => error.message.includes(k));
      if (code) return { ok: false, error: SLOT_ERRORS[code]! };
      throw new Error(`place_order : ${error.message}`);
    }
    const order = rows?.[0];
    if (!order) throw new Error('place_order : aucune commande renvoyée');

    if (data.paymentMethod === 'on_site') {
      await notifyOrderPlaced(order.order_id);
      return { ok: true, token: order.order_token, number: order.order_number, payment: null };
    }

    const intent = await createPaymentIntent({
      amountCents: total,
      currency: restaurant.currency,
      accountId: restaurant.stripeAccountId,
      orderId: order.order_id,
      orderNumber: order.order_number,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    });
    const { error: updateError } = await admin
      .from('orders')
      .update({ stripe_payment_intent_id: intent.intentId })
      .eq('id', order.order_id);
    if (updateError) throw new Error(`orders.stripe_payment_intent_id : ${updateError.message}`);

    return { ok: true, token: order.order_token, number: order.order_number, payment: intent };
  } catch (error) {
    console.error('[checkout] placeOrder', error);
    return { ok: false, error: 'server_error' };
  }
}
