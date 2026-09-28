import type { MenuCategory, MenuProduct } from '@/lib/storefront/types';

/** Panier : fonctions pures partagées entre le front et (phase 3) le serveur. */

export const MAX_QUANTITY = 99;

export interface CartOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDeltaCents: number;
}

export interface CartLine {
  /** Identité de la ligne : même produit + mêmes options + même note = même ligne. */
  key: string;
  productId: string;
  name: string;
  basePriceCents: number;
  options: CartOption[];
  quantity: number;
  notes: string;
}

/** Options choisies par groupe : { [groupId]: optionId[] } */
export type Selection = Record<string, string[]>;

export type SelectionError = { groupId: string; kind: 'min' | 'max' | 'unknown' };

export function lineKey(productId: string, optionIds: string[], notes: string): string {
  return [productId, [...optionIds].sort().join(','), notes.trim().toLowerCase()].join('|');
}

export function unitPrice(line: Pick<CartLine, 'basePriceCents' | 'options'>): number {
  return line.basePriceCents + line.options.reduce((sum, o) => sum + o.priceDeltaCents, 0);
}

export function lineTotal(line: CartLine): number {
  return unitPrice(line) * line.quantity;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function validateSelection(product: MenuProduct, selection: Selection): SelectionError[] {
  const errors: SelectionError[] = [];
  for (const group of product.optionGroups) {
    const chosen = selection[group.id] ?? [];
    if (chosen.some((id) => !group.options.some((o) => o.id === id))) {
      errors.push({ groupId: group.id, kind: 'unknown' });
    } else if (chosen.length < group.minSelect) {
      errors.push({ groupId: group.id, kind: 'min' });
    } else if (chosen.length > group.maxSelect) {
      errors.push({ groupId: group.id, kind: 'max' });
    }
  }
  for (const groupId of Object.keys(selection)) {
    if (!product.optionGroups.some((g) => g.id === groupId))
      errors.push({ groupId, kind: 'unknown' });
  }
  return errors;
}

/** Prix unitaire d'un produit avec une sélection (pour le bouton « Ajouter »). */
export function selectionUnitPrice(product: MenuProduct, selection: Selection): number {
  let total = product.priceCents;
  for (const group of product.optionGroups) {
    for (const id of selection[group.id] ?? []) {
      total += group.options.find((o) => o.id === id)?.priceDeltaCents ?? 0;
    }
  }
  return total;
}

export function buildLine(
  product: MenuProduct,
  selection: Selection,
  quantity: number,
  notes = '',
): CartLine {
  if (product.isSoldOut) throw new Error(`${product.name} est en rupture`);
  if (validateSelection(product, selection).length > 0) {
    throw new Error(`Sélection invalide pour ${product.name}`);
  }
  const options: CartOption[] = product.optionGroups.flatMap((group) =>
    group.options
      .filter((o) => (selection[group.id] ?? []).includes(o.id))
      .map((o) => ({
        groupId: group.id,
        groupName: group.name,
        optionId: o.id,
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
      })),
  );
  const cleanNotes = notes.trim().slice(0, 200);
  return {
    key: lineKey(
      product.id,
      options.map((o) => o.optionId),
      cleanNotes,
    ),
    productId: product.id,
    name: product.name,
    basePriceCents: product.priceCents,
    options,
    quantity: clampQuantity(quantity),
    notes: cleanNotes,
  };
}

export function clampQuantity(q: number): number {
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(q)));
}

export function indexProducts(categories: MenuCategory[]): Map<string, MenuProduct> {
  return new Map(categories.flatMap((c) => c.products.map((p) => [p.id, p] as const)));
}

/**
 * Remet le panier en phase avec la carte actuelle : retire les produits disparus,
 * en rupture ou dont une option n'existe plus, et réapplique les prix du jour.
 */
export function reconcileCart(
  lines: CartLine[],
  categories: MenuCategory[],
): { lines: CartLine[]; removed: string[] } {
  const products = indexProducts(categories);
  const kept: CartLine[] = [];
  const removed: string[] = [];

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || product.isSoldOut) {
      removed.push(line.name);
      continue;
    }
    const selection: Selection = {};
    for (const o of line.options) (selection[o.groupId] ??= []).push(o.optionId);
    if (validateSelection(product, selection).length > 0) {
      removed.push(line.name);
      continue;
    }
    const fresh = buildLine(product, selection, line.quantity, line.notes);
    kept.push(fresh);
  }
  return { lines: kept, removed };
}
