import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Enums } from '@/types/database';

/** Carte complète pour l'éditeur (éléments masqués inclus : la RLS les montre à l'équipe). */

export interface AdminOption {
  id: string;
  name: string;
  priceDeltaCents: number;
  isActive: boolean;
}
export interface AdminOptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: AdminOption[];
}
export interface AdminProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrls: string[];
  dietTags: Enums<'diet_tag'>[];
  allergens: Enums<'allergen'>[];
  isActive: boolean;
  isSoldOut: boolean;
  isUpsell: boolean;
  prepTimeMinutes: number | null;
  optionGroups: AdminOptionGroup[];
}
export interface AdminCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tone: Enums<'accent_tone'>;
  isActive: boolean;
  products: AdminProduct[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export async function loadAdminMenu(menuId: string): Promise<AdminCategory[]> {
  const { data, error } = await createClient()
    .from('categories')
    .select(
      `id, name, description, emoji, tone, is_active, position,
       products ( id, category_id, name, description, price_cents, image_urls, diet_tags, allergens,
         is_active, is_sold_out, is_upsell, prep_time_minutes, position,
         option_groups ( id, name, min_select, max_select, position,
           options ( id, name, price_delta_cents, is_active, position ) ) )`,
    )
    .eq('menu_id', menuId);
  if (error) throw new Error(`carte : ${error.message}`);

  return [...(data ?? [])].sort(byPosition).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    emoji: c.emoji ?? '',
    tone: c.tone,
    isActive: c.is_active,
    products: [...c.products].sort(byPosition).map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description ?? '',
      priceCents: p.price_cents,
      imageUrls: p.image_urls,
      dietTags: p.diet_tags,
      allergens: p.allergens,
      isActive: p.is_active,
      isSoldOut: p.is_sold_out,
      isUpsell: p.is_upsell,
      prepTimeMinutes: p.prep_time_minutes,
      optionGroups: [...p.option_groups].sort(byPosition).map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        options: [...g.options].sort(byPosition).map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaCents: o.price_delta_cents,
          isActive: o.is_active,
        })),
      })),
    })),
  }));
}
