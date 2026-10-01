import { getPublicEnv } from '@/lib/env';

/** Seules les images du dossier Storage du restaurant (bucket « menu ») sont acceptées. */
export function isOwnImageUrl(url: string, restaurantId: string): boolean {
  const base = `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu/${restaurantId}/`;
  return url.startsWith(base) && !url.includes('..');
}
