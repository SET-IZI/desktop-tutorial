import { z } from 'zod';

/**
 * Carte à importer (CSV ou photo analysée par IA), relue par le restaurateur
 * avant l'import. Prix en centimes.
 */
export const importProductSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(600).default(''),
  priceCents: z.number().int().min(0).max(1_000_000),
});

export const importCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  products: z.array(importProductSchema).min(1).max(100),
});

export const importDraftSchema = z.object({
  categories: z.array(importCategorySchema).min(1).max(30),
});

export type ImportDraft = z.infer<typeof importDraftSchema>;
export type ImportDraftInput = z.input<typeof importDraftSchema>;

export function countProducts(draft: ImportDraft): number {
  return draft.categories.reduce((n, c) => n + c.products.length, 0);
}
