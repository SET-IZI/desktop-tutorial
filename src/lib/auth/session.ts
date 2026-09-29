import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Enums } from '@/types/database';

export type MemberRole = Enums<'member_role'>;

export interface Membership {
  restaurantId: string;
  role: MemberRole;
  name: string;
  slug: string;
  isPublished: boolean;
  onboardingStep: number;
}

/** Restaurant actif dans le back-office (multi-restaurants). */
export const RESTAURANT_COOKIE = 'miaamm_restaurant';

/** Utilisateur connecté (hors session anonyme), ou null. Mis en cache par requête. */
export const getUser = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user && !data.user.is_anonymous ? data.user : null;
});

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users_roles')
    .select('role, restaurants ( id, name, slug, is_published, onboarding_step )')
    .eq('user_id', user.id)
    .order('created_at');
  if (error) throw new Error(`users_roles : ${error.message}`);
  return (data ?? [])
    .filter((m) => m.restaurants)
    .map((m) => ({
      restaurantId: m.restaurants!.id,
      role: m.role,
      name: m.restaurants!.name,
      slug: m.restaurants!.slug,
      isPublished: m.restaurants!.is_published,
      onboardingStep: m.restaurants!.onboarding_step,
    }));
});

/** Contexte du back-office : utilisateur + restaurant actif (redirige sinon). */
export const requireRestaurant = cache(async () => {
  const user = await getUser();
  if (!user) redirect('/login');
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect('/app/onboarding');
  const wanted = cookies().get(RESTAURANT_COOKIE)?.value;
  const current = memberships.find((m) => m.restaurantId === wanted) ?? memberships[0]!;
  return { user, memberships, current };
});

/** Vérifie un rôle minimum ; renvoie le contexte ou lève une erreur (actions serveur). */
export async function assertRole(allowed: MemberRole[]) {
  const ctx = await requireRestaurant();
  if (!allowed.includes(ctx.current.role)) throw new Error('forbidden');
  return ctx;
}

export const canManage = (role: MemberRole) => role === 'owner' || role === 'manager';
