import { NextResponse, type NextRequest } from 'next/server';
import { assertRole } from '@/lib/auth/session';
import { getPaymentsEnv, getPublicEnv } from '@/lib/env';
import { createOnboardingLink, getAccountStatus } from '@/lib/payments/connect';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Retour de l'onboarding Stripe (return_url) et lien expiré (refresh_url, ?refresh=1).
 * Le webhook account.updated tient ensuite stripe_charges_enabled à jour.
 */
export async function GET(request: NextRequest) {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const back = (status: string) => NextResponse.redirect(`${base}/app/onboarding?stripe=${status}`);

  let current;
  try {
    ({ current } = await assertRole(['owner']));
  } catch {
    return NextResponse.redirect(`${base}/app`);
  }
  if (getPaymentsEnv().mode !== 'stripe') return back('unavailable');

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('stripe_account_id')
    .eq('id', current.restaurantId)
    .single();
  const accountId = restaurant?.stripe_account_id;
  if (!accountId) return back('missing');

  if (request.nextUrl.searchParams.get('refresh')) {
    return NextResponse.redirect(await createOnboardingLink(accountId));
  }

  const status = await getAccountStatus(accountId);
  await admin
    .from('restaurants')
    .update({ stripe_charges_enabled: status.chargesEnabled })
    .eq('id', current.restaurantId);
  if (!status.detailsSubmitted) return back('incomplete');

  // Dossier envoyé : l'étape est franchie, même si Stripe vérifie encore le compte.
  await createClient()
    .from('restaurants')
    .update({ onboarding_step: 4 })
    .eq('id', current.restaurantId)
    .lt('onboarding_step', 4);
  return back(status.chargesEnabled ? 'connected' : 'pending');
}
