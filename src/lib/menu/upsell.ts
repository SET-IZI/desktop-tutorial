import type { CartLine } from '@/lib/cart/lines';
import type { MenuCategory, MenuProduct } from '@/lib/storefront/types';

/**
 * Suggestions avant paiement : produits marqués « upsell », disponibles, pas déjà
 * dans le panier, en privilégiant les catégories absentes du panier (pas de
 * boisson → une boisson ; pas de dessert → un dessert). Une par catégorie d'abord.
 */
export function suggestUpsell(
  categories: MenuCategory[],
  lines: CartLine[],
  limit = 3,
): MenuProduct[] {
  if (lines.length === 0) return [];
  const inCart = new Set(lines.map((l) => l.productId));
  const categoriesInCart = new Set(
    categories.filter((c) => c.products.some((p) => inCart.has(p.id))).map((c) => c.id),
  );

  const candidates = categories.flatMap((c) =>
    c.products.filter((p) => p.isUpsell && !p.isSoldOut && !inCart.has(p.id)),
  );

  const missingFirst = [...candidates].sort(
    (a, b) =>
      Number(categoriesInCart.has(a.categoryId)) - Number(categoriesInCart.has(b.categoryId)),
  );

  const picked: MenuProduct[] = [];
  const usedCategories = new Set<string>();
  for (const p of missingFirst) {
    if (picked.length >= limit) break;
    if (usedCategories.has(p.categoryId)) continue;
    picked.push(p);
    usedCategories.add(p.categoryId);
  }
  for (const p of missingFirst) {
    if (picked.length >= limit) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}
