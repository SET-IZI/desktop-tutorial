'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getLocations, LOCATION_COOKIE } from '@/lib/admin/location';
import { getMemberships, RESTAURANT_COOKIE } from '@/lib/auth/session';

/** Sélecteurs du back-office : restaurant et établissement actifs (cookies). */

const COOKIE = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
};

export async function switchRestaurant(restaurantId: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(restaurantId).success) return { ok: false };
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.restaurantId === restaurantId)) return { ok: false };
  cookies().set(RESTAURANT_COOKIE, restaurantId, COOKIE);
  // L'établissement choisi appartenait à l'ancien restaurant.
  cookies().delete(LOCATION_COOKIE);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function switchLocation(
  restaurantId: string,
  locationId: string,
): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(locationId).success) return { ok: false };
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.restaurantId === restaurantId)) return { ok: false };
  // La RLS ne renvoie que les établissements d'un restaurant dont on fait partie.
  const locations = await getLocations(restaurantId);
  if (!locations.some((l) => l.id === locationId)) return { ok: false };
  cookies().set(LOCATION_COOKIE, locationId, COOKIE);
  revalidatePath('/app', 'layout');
  return { ok: true };
}
