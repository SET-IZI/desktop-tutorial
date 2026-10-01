'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getCurrentLocation } from '@/lib/admin/location';
import {
  categorySchema,
  productSchema,
  type CategoryInput,
  type ProductInput,
} from '@/lib/admin/product-schema';
import { assertRole } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { storefrontTag } from '@/lib/storefront/queries';
import { createClient } from '@/lib/supabase/server';
import { isOwnImageUrl } from '@/lib/admin/storage-url';

export type MenuActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function context() {
  const ctx = await assertRole(['owner', 'manager']);
  const location = await getCurrentLocation(ctx.current.restaurantId);
  if (!location?.menu_id) throw new Error('no_menu');
  return { ...ctx, menuId: location.menu_id, supabase: createClient() };
}

async function run(fn: () => Promise<MenuActionResult>): Promise<MenuActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'forbidden' || error.message.includes('forbidden'))
    ) {
      return { ok: false, error: 'forbidden' };
    }
    console.error('[menu]', error);
    return { ok: false, error: 'server_error' };
  }
}

function refresh(slug: string) {
  revalidateTag(storefrontTag(slug));
  revalidatePath('/app/carte');
}

// ═══ Catégories ═════════════════════════════════════════════════════════════

export async function saveCategory(input: CategoryInput): Promise<MenuActionResult> {
  return run(async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
    const { supabase, current, menuId } = await context();
    const d = parsed.data;
    const values = {
      name: d.name,
      description: d.description || null,
      emoji: d.emoji || null,
      tone: d.tone,
      is_active: d.isActive,
    };
    if (d.id) {
      const { error } = await supabase.from('categories').update(values).eq('id', d.id);
      if (error) throw new Error(error.message);
      refresh(current.slug);
      return { ok: true, id: d.id };
    }
    const { data: last } = await supabase
      .from('categories')
      .select('position')
      .eq('menu_id', menuId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...values,
        restaurant_id: current.restaurantId,
        menu_id: menuId,
        position: (last?.position ?? -1) + 1,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true, id: data.id };
  });
}

export async function deleteCategory(id: string): Promise<MenuActionResult> {
  return run(async () => {
    if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

export async function reorderCategories(ids: string[]): Promise<MenuActionResult> {
  return run(async () => {
    if (!z.array(z.uuid()).max(200).safeParse(ids).success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase.rpc('reorder_categories', { p_ids: ids });
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

// ═══ Plats ══════════════════════════════════════════════════════════════════

export async function saveProduct(input: ProductInput): Promise<MenuActionResult> {
  return run(async () => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
    const { supabase, current } = await context();
    const d = parsed.data;
    if (d.imageUrls.some((u) => !isOwnImageUrl(u, current.restaurantId)))
      return { ok: false, error: 'invalid' };

    const { data, error } = await supabase.rpc('save_product', {
      p: {
        id: d.id ?? null,
        category_id: d.categoryId,
        name: d.name,
        description: d.description,
        price_cents: d.priceCents,
        image_urls: d.imageUrls,
        diet_tags: d.dietTags,
        allergens: d.allergens,
        is_active: d.isActive,
        is_sold_out: d.isSoldOut,
        is_upsell: d.isUpsell,
        prep_time_minutes: null,
        groups: d.optionGroups.map((g) => ({
          id: g.id ?? null,
          name: g.name,
          min_select: g.minSelect,
          max_select: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id ?? null,
            name: o.name,
            price_delta_cents: o.priceDeltaCents,
            is_active: o.isActive,
          })),
        })),
      },
    });
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true, id: data };
  });
}

export async function deleteProduct(id: string): Promise<MenuActionResult> {
  return run(async () => {
    if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

const flagsSchema = z.object({
  isActive: z.boolean().optional(),
  isSoldOut: z.boolean().optional(),
});

/** Activation / rupture en un geste. */
export async function setProductFlags(
  id: string,
  flags: z.input<typeof flagsSchema>,
): Promise<MenuActionResult> {
  return run(async () => {
    const parsed = flagsSchema.safeParse(flags);
    if (!z.uuid().safeParse(id).success || !parsed.success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase
      .from('products')
      .update({
        ...(parsed.data.isActive === undefined ? {} : { is_active: parsed.data.isActive }),
        ...(parsed.data.isSoldOut === undefined ? {} : { is_sold_out: parsed.data.isSoldOut }),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}

export async function reorderProducts(ids: string[]): Promise<MenuActionResult> {
  return run(async () => {
    if (!z.array(z.uuid()).max(500).safeParse(ids).success) return { ok: false, error: 'invalid' };
    const { supabase, current } = await context();
    const { error } = await supabase.rpc('reorder_products', { p_ids: ids });
    if (error) throw new Error(error.message);
    refresh(current.slug);
    return { ok: true };
  });
}
