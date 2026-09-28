import type { Allergen, MenuCategory, MenuProduct } from '@/lib/storefront/types';

export type DietFilter = 'vegetarian' | 'vegan' | 'gluten_free';

export interface MenuFilters {
  query: string;
  diets: DietFilter[];
  excludedAllergens: Allergen[];
}

export const EMPTY_FILTERS: MenuFilters = { query: '', diets: [], excludedAllergens: [] };

export function hasActiveFilters(f: MenuFilters): boolean {
  return f.query.trim() !== '' || f.diets.length > 0 || f.excludedAllergens.length > 0;
}

const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss' };

/** Minuscules sans accents ni ligatures : "Bœuf brûlé" → "boeuf brule". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[œæß]/g, (c) => LIGATURES[c] ?? c)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function satisfiesDiet(product: MenuProduct, diet: DietFilter): boolean {
  // Un plat vegan est aussi végétarien.
  if (diet === 'vegetarian') {
    return product.dietTags.includes('vegetarian') || product.dietTags.includes('vegan');
  }
  return product.dietTags.includes(diet);
}

export function matchesFilters(
  product: MenuProduct,
  filters: MenuFilters,
  categoryName = '',
): boolean {
  if (!filters.diets.every((d) => satisfiesDiet(product, d))) return false;
  if (product.allergens.some((a) => filters.excludedAllergens.includes(a))) return false;

  const tokens = normalize(filters.query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalize(`${product.name} ${product.description ?? ''} ${categoryName}`);
  return tokens.every((t) => haystack.includes(t));
}

/** Catégories filtrées ; celles sans produit correspondant disparaissent. */
export function filterMenu(categories: MenuCategory[], filters: MenuFilters): MenuCategory[] {
  if (!hasActiveFilters(filters)) return categories;
  return categories
    .map((c) => ({ ...c, products: c.products.filter((p) => matchesFilters(p, filters, c.name)) }))
    .filter((c) => c.products.length > 0);
}
