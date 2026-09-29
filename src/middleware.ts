import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveTenantSlug } from '@/lib/tenant';

/**
 * 1. {slug}.miaamm.app/... → /s/{slug}/... (boutique ; aussi accessible via /s/{slug}).
 * 2. Back-office (/app) : session rafraîchie, connexion obligatoire.
 */
export async function middleware(request: NextRequest) {
  const slug = resolveTenantSlug(request.headers.get('host'), process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  if (slug) {
    const url = request.nextUrl.clone();
    if (url.pathname.startsWith(`/s/${slug}`)) return NextResponse.next();
    url.pathname = `/s/${slug}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  const { pathname } = request.nextUrl;
  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (!isApp && !isAuthPage) return NextResponse.next();

  const response = NextResponse.next({ request });
  const user = await updateSession(request, response);
  const signedIn = Boolean(user && !user.is_anonymous);

  if (isApp && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (isAuthPage && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Ni les assets, ni l'API, ni les fichiers statiques.
  matcher: ['/((?!_next/|api/|favicon|icon|.*\\..*).*)'],
};
