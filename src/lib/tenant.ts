/** Sous-domaine boutique : "chez-mimi.miaamm.app" → "chez-mimi". */

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'kitchen', 'driver', 'embed', 'static']);

export function resolveTenantSlug(
  host: string | null,
  rootDomain: string | undefined,
): string | null {
  if (!host || !rootDomain) return null;
  const hostname = host.split(':')[0]!.toLowerCase();
  const root = rootDomain.split(':')[0]!.toLowerCase();
  if (!hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, -(root.length + 1));
  if (sub.includes('.') || RESERVED.has(sub) || !SLUG.test(sub)) return null;
  return sub;
}
