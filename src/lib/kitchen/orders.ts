import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Enums } from '@/types/database';

export type OrderStatus = Enums<'order_status'>;

/** Commandes visibles en cuisine : à traiter, en cours, prêtes. */
export const KITCHEN_STATUSES = ['new', 'accepted', 'preparing', 'ready'] as const;

export interface KitchenOrder {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  fulfillment: Enums<'fulfillment_type'>;
  scheduledFor: string | null;
  extraMinutes: number;
  totalCents: number;
  paymentMethod: Enums<'payment_method'>;
  paymentStatus: Enums<'payment_status'>;
  notes: string | null;
  placedAt: string | null;
  items: { id: string; name: string; quantity: number; options: string[]; notes: string | null }[];
}

type OptionSnapshot = { group?: string; name?: string };

export async function loadKitchenOrders(locationId: string): Promise<KitchenOrder[]> {
  const { data, error } = await createClient()
    .from('orders')
    .select(
      `id, number, status, customer_name, customer_phone, fulfillment, scheduled_for,
       extra_minutes, total_cents, payment_method, payment_status, notes, placed_at,
       order_items ( id, name, quantity, options, notes )`,
    )
    .eq('location_id', locationId)
    .in('status', [...KITCHEN_STATUSES])
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('number');
  if (error) throw new Error(`orders : ${error.message}`);
  return data.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    fulfillment: o.fulfillment,
    scheduledFor: o.scheduled_for,
    extraMinutes: o.extra_minutes,
    totalCents: o.total_cents,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    notes: o.notes,
    placedAt: o.placed_at,
    items: o.order_items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      options: (Array.isArray(i.options) ? (i.options as OptionSnapshot[]) : [])
        .map((opt) => opt?.name)
        .filter((n): n is string => Boolean(n)),
      notes: i.notes,
    })),
  }));
}
