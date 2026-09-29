import { getPublicEnv } from '@/lib/env';

/**
 * Adresse publique de la boutique : sous-domaine « {slug}.{domaine racine} » quand
 * NEXT_PUBLIC_ROOT_DOMAIN est défini, sinon « {APP_URL}/s/{slug} ».
 */
export function shopPublicUrl(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) return `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/s/${slug}`;
  const protocol = /^(localhost|127\.0\.0\.1)(:|$)/.test(root) ? 'http' : 'https';
  return `${protocol}://${slug}.${root}`;
}
