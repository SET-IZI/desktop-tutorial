'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentLocation } from '@/lib/admin/location';
import { assertRole, getUser, RESTAURANT_COOKIE } from '@/lib/auth/session';
import { getPaymentsEnv } from '@/lib/env';
import { geocodeAddress } from '@/lib/geo/geocode';
import {
  AI_IMPORT_MAX_BYTES,
  AI_IMPORT_TYPES,
  extractMenuFromFile,
  type AiImportType,
} from '@/lib/menu-import/ai';
import {
  importDraftSchema,
  type ImportDraft,
  type ImportDraftInput,
} from '@/lib/menu-import/draft';
import { createConnectedAccount, createOnboardingLink } from '@/lib/payments/connect';
import { storefrontTag } from '@/lib/storefront/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidSlug } from '@/lib/tenant';

/**
 * Onboarding en 5 étapes. `restaurants.onboarding_step` = nombre d'étapes terminées :
 * 1 profil · 2 horaires · 3 carte · 4 paiements · 5 publication.
 * Écritures via le client de l'utilisateur (RLS), sauf les colonnes Stripe,
 * réservées au serveur (client service-role).
 */

export type OnboardingResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string; field?: string };

async function guard<R extends { ok: boolean }>(
  fn: () => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    // redirect() lève une erreur spéciale que Next.js doit recevoir.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    console.error('[onboarding]', error);
    return { ok: false, error: 'server_error' };
  }
}

/** Avance l'onboarding sans jamais reculer. */
async function advance(restaurantId: string, step: number) {
  const { error } = await createClient()
    .from('restaurants')
    .update({ onboarding_step: step })
    .eq('id', restaurantId)
    .lt('onboarding_step', step);
  if (error) throw new Error(error.message);
  revalidatePath('/app', 'layout');
}

// ═══ 1 · Profil ══════════════════════════════════════════════════════════════

const profileSchema = z.object({
  name: z.string().trim().min(1, 'name').max(80, 'name'),
  slug: z.string().trim().toLowerCase().refine(isValidSlug, 'slug'),
  addressLine: z.string().trim().min(3, 'address').max(120, 'address'),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'postalCode'),
  city: z.string().trim().min(1, 'city').max(80, 'city'),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s.-]{7,19}$/, 'phone')
    .or(z.literal('')),
});

export async function createRestaurant(
  input: z.input<typeof profileSchema>,
): Promise<OnboardingResult> {
  return guard(async () => {
    const user = await getUser();
    if (!user) return { ok: false, error: 'forbidden' };
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return { ok: false, error: 'invalid', field: issue.message };
    }
    const d = parsed.data;

    const geo = await geocodeAddress(d);
    if (!geo.ok) return { ok: false, error: `geocode_${geo.error}`, field: 'address' };

    const supabase = createClient();
    const { data: restaurantId, error } = await supabase.rpc('create_restaurant', {
      p_name: d.name,
      p_slug: d.slug,
      p_location: {
        address_line: d.addressLine,
        postal_code: d.postalCode,
        city: d.city,
        lat: geo.lat,
        lng: geo.lng,
        phone: d.phone || null,
      },
    });
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'slug_taken', field: 'slug' };
      throw new Error(error.message);
    }
    await advance(restaurantId, 1);
    cookies().set(RESTAURANT_COOKIE, restaurantId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
    return { ok: true };
  });
}

// ═══ 2 · Horaires (enregistrés par saveHours) ════════════════════════════════

export async function completeHours(): Promise<OnboardingResult> {
  return guard(async () => {
    const { current } = await assertRole(['owner', 'manager']);
    await advance(current.restaurantId, 2);
    return { ok: true };
  });
}

// ═══ 3 · Carte ═══════════════════════════════════════════════════════════════

export async function analyzeMenuFile(
  formData: FormData,
): Promise<OnboardingResult<{ draft: ImportDraft }>> {
  return guard(async () => {
    await assertRole(['owner', 'manager']);
    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, error: 'invalid' };
    if (!AI_IMPORT_TYPES.includes(file.type as AiImportType)) {
      return { ok: false, error: 'file_type' };
    }
    if (file.size > AI_IMPORT_MAX_BYTES) return { ok: false, error: 'file_size' };
    const result = await extractMenuFromFile(
      Buffer.from(await file.arrayBuffer()),
      file.type as AiImportType,
    );
    return result.ok
      ? { ok: true, draft: result.draft }
      : { ok: false, error: `ai_${result.error}` };
  });
}

export async function importMenu(
  draft: ImportDraftInput,
): Promise<OnboardingResult<{ count: number }>> {
  return guard(async () => {
    const { current } = await assertRole(['owner', 'manager']);
    const parsed = importDraftSchema.safeParse(draft);
    if (!parsed.success) return { ok: false, error: 'invalid' };
    const location = await getCurrentLocation(current.restaurantId);
    if (!location?.menu_id) throw new Error('no_menu');

    const { data, error } = await createClient().rpc('import_menu', {
      p_menu_id: location.menu_id,
      p: {
        categories: parsed.data.categories.map((c) => ({
          name: c.name,
          products: c.products.map((p) => ({
            name: p.name,
            description: p.description,
            price_cents: p.priceCents,
          })),
        })),
      },
    });
    if (error) {
      if (error.message.includes('forbidden')) return { ok: false, error: 'forbidden' };
      throw new Error(error.message);
    }
    await advance(current.restaurantId, 3);
    revalidateTag(storefrontTag(current.slug));
    return { ok: true, count: data };
  });
}

/** Passer l'étape : la carte se construit ensuite dans l'éditeur. */
export async function skipMenu(): Promise<OnboardingResult> {
  return guard(async () => {
    const { current } = await assertRole(['owner', 'manager']);
    await advance(current.restaurantId, 3);
    return { ok: true };
  });
}

// ═══ 4 · Paiements ═══════════════════════════════════════════════════════════

/**
 * Connecte Stripe : crée le compte si besoin puis renvoie vers l'onboarding
 * hébergé par Stripe. En mode simulé, le compte est « connecté » immédiatement.
 */
export async function connectStripe(): Promise<OnboardingResult> {
  return guard(async () => {
    const { current, user } = await assertRole(['owner']);
    const admin = createAdminClient();
    const { data: restaurant, error } = await admin
      .from('restaurants')
      .select('id, name, stripe_account_id')
      .eq('id', current.restaurantId)
      .single();
    if (error) throw new Error(error.message);

    if (getPaymentsEnv().mode === 'mock') {
      const { error: updateError } = await admin
        .from('restaurants')
        .update({
          stripe_account_id:
            restaurant.stripe_account_id ?? `acct_mock_${randomUUID().replace(/-/g, '')}`,
          stripe_charges_enabled: true,
        })
        .eq('id', restaurant.id);
      if (updateError) throw new Error(updateError.message);
      await advance(restaurant.id, 4);
      return { ok: true };
    }

    let accountId = restaurant.stripe_account_id;
    if (!accountId) {
      accountId = await createConnectedAccount({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        email: user.email,
      });
      const { error: updateError } = await admin
        .from('restaurants')
        .update({ stripe_account_id: accountId })
        .eq('id', restaurant.id);
      if (updateError) throw new Error(updateError.message);
    }
    redirect(await createOnboardingLink(accountId));
  });
}

/** Sans Stripe pour l'instant : paiement sur place activé, carte bancaire plus tard. */
export async function payOnSiteOnly(): Promise<OnboardingResult> {
  return guard(async () => {
    const { current } = await assertRole(['owner', 'manager']);
    const location = await getCurrentLocation(current.restaurantId);
    if (!location) throw new Error('no_location');
    const { error } = await createClient()
      .from('locations')
      .update({ on_site_payment_enabled: true })
      .eq('id', location.id);
    if (error) throw new Error(error.message);
    await advance(current.restaurantId, 4);
    revalidateTag(storefrontTag(current.slug));
    return { ok: true };
  });
}

// ═══ 5 · Publication ═════════════════════════════════════════════════════════

export async function publishRestaurant(): Promise<OnboardingResult> {
  return guard(async () => {
    const { current } = await assertRole(['owner', 'manager']);
    const { error } = await createClient()
      .from('restaurants')
      .update({ is_published: true, onboarding_step: 5 })
      .eq('id', current.restaurantId);
    if (error) throw new Error(error.message);
    revalidateTag(storefrontTag(current.slug));
    revalidatePath('/app', 'layout');
    redirect('/app?welcome=1');
  });
}
