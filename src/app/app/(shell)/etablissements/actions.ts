'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getLocations, LOCATION_COOKIE } from '@/lib/admin/location';
import { assertRole } from '@/lib/auth/session';
import { geocodeAddress } from '@/lib/geo/geocode';
import { storefrontTag } from '@/lib/storefront/queries';
import { createClient } from '@/lib/supabase/server';

/**
 * Établissements : la carte est celle du restaurant (partagée), les horaires,
 * la capacité et les modes de commande sont propres à chaque établissement.
 * Un nouvel établissement est créé masqué : on règle ses horaires, puis on l'active.
 */

export type LocationResult = { ok: true } | { ok: false; error: string; field?: string };

const locationSchema = z.object({
  name: z.string().trim().min(1, 'name').max(80, 'name'),
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

export async function createLocation(
  input: z.input<typeof locationSchema>,
): Promise<LocationResult> {
  try {
    const parsed = locationSchema.safeParse(input);
    if (!parsed.success) {
      const field = parsed.error.issues[0]!.message;
      return { ok: false, error: field, field };
    }
    const { current } = await assertRole(['owner', 'manager']);
    const [first] = await getLocations(current.restaurantId);
    if (!first?.menu_id) throw new Error('no_menu');

    const d = parsed.data;
    const geo = await geocodeAddress(d);
    if (!geo.ok) return { ok: false, error: `geocode_${geo.error}`, field: 'address' };

    const { data, error } = await createClient()
      .from('locations')
      .insert({
        restaurant_id: current.restaurantId,
        menu_id: first.menu_id,
        name: d.name,
        address_line: d.addressLine,
        postal_code: d.postalCode,
        city: d.city,
        phone: d.phone || null,
        lat: geo.lat,
        lng: geo.lng,
        timezone: first.timezone,
        is_active: false,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    // On bascule sur le nouvel établissement pour régler ses horaires.
    cookies().set(LOCATION_COOKIE, data.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath('/app', 'layout');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    console.error('[locations]', error);
    return { ok: false, error: 'server_error' };
  }
}

export async function setLocationActive(id: string, active: boolean): Promise<LocationResult> {
  try {
    if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
    const { current } = await assertRole(['owner', 'manager']);
    const locations = await getLocations(current.restaurantId);
    if (!locations.some((l) => l.id === id)) return { ok: false, error: 'invalid' };
    // La boutique garde toujours au moins un établissement ouvert aux commandes.
    if (!active && !locations.some((l) => l.id !== id && l.is_active)) {
      return { ok: false, error: 'last_active' };
    }
    const { error } = await createClient()
      .from('locations')
      .update({ is_active: active })
      .eq('id', id);
    if (error) throw new Error(error.message);
    revalidateTag(storefrontTag(current.slug));
    revalidatePath('/app', 'layout');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    console.error('[locations]', error);
    return { ok: false, error: 'server_error' };
  }
}
