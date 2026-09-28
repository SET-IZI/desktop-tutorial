import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenantSlug } from '@/lib/tenant';

/** {slug}.miaamm.app/... → /s/{slug}/... (la boutique reste aussi accessible via /s/{slug}). */
export function middleware(request: NextRequest) {
  const slug = resolveTenantSlug(request.headers.get('host'), process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  if (!slug) return NextResponse.next();
  const url = request.nextUrl.clone();
  if (url.pathname.startsWith(`/s/${slug}`)) return NextResponse.next();
  url.pathname = `/s/${slug}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Ni les assets, ni l'API, ni les fichiers statiques.
  matcher: ['/((?!_next/|api/|favicon|icon|.*\\..*).*)'],
};
