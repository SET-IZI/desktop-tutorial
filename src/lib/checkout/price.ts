import {
  buildLine,
  indexProducts,
  lineTotal,
  unitPrice,
  validateSelection,
  type Selection,
} from '@/lib/cart/lines';
import type { MenuCategory } from '@/lib/storefront/types';
import type { CheckoutData } from './schema';

/**
 * Recalcul du prix côté serveur à partir de la carte actuelle : le client n'envoie
 * que des identifiants et des quantités, jamais de montants.
 */

// `type` (et non `interface`) : compatible avec le type Json de Supabase.
export type PricedItem = {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  options: { group: string; name: string; price_delta_cents: number }[];
  notes: string;
  total_cents: number;
};

export type PriceResult =
  | { ok: true; items: PricedItem[]; subtotalCents: number }
  | { ok: false; error: 'product_unavailable'; productName?: string };

export function priceOrder(categories: MenuCategory[], lines: CheckoutData['lines']): PriceResult {
  const products = indexProducts(categories);
  const items: PricedItem[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || product.isSoldOut) {
      return { ok: false, error: 'product_unavailable', productName: product?.name };
    }

    const selection: Selection = {};
    for (const optionId of line.optionIds) {
      const group = product.optionGroups.find((g) => g.options.some((o) => o.id === optionId));
      if (!group) return { ok: false, error: 'product_unavailable', productName: product.name };
      (selection[group.id] ??= []).push(optionId);
    }
    if (validateSelection(product, selection).length > 0) {
      return { ok: false, error: 'product_unavailable', productName: product.name };
    }

    const built = buildLine(product, selection, line.quantity, line.notes);
    items.push({
      product_id: product.id,
      name: product.name,
      unit_price_cents: unitPrice(built),
      quantity: built.quantity,
      options: built.options.map((o) => ({
        group: o.groupName,
        name: o.name,
        price_delta_cents: o.priceDeltaCents,
      })),
      notes: built.notes,
      total_cents: lineTotal(built),
    });
  }

  return { ok: true, items, subtotalCents: items.reduce((sum, i) => sum + i.total_cents, 0) };
}
