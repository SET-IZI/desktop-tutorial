import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import { HoursStep } from '@/components/onboarding/hours-step';
import { MenuStep } from '@/components/onboarding/menu-step';
import { PaymentsStep } from '@/components/onboarding/payments-step';
import { ProfileStep } from '@/components/onboarding/profile-step';
import { PublishStep } from '@/components/onboarding/publish-step';
import { Stepper } from '@/components/onboarding/stepper';
import { ToastProvider } from '@/components/ui/toast';
import { Wordmark } from '@/components/ui/wordmark';
import { getCurrentLocation } from '@/lib/admin/location';
import { scheduleFromRows } from '@/lib/admin/schedule';
import { getMemberships, getUser, RESTAURANT_COOKIE } from '@/lib/auth/session';
import { getAiImportEnv } from '@/lib/env';
import { shopPublicUrl } from '@/lib/storefront/url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Configuration',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

const TOTAL = 5;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { step?: string; stripe?: string };
}) {
  const user = await getUser();
  if (!user) redirect('/login?next=/app/onboarding');
  const t = await getTranslations('onboarding');

  const memberships = await getMemberships();
  const wanted = cookies().get(RESTAURANT_COOKIE)?.value;
  const current = memberships.find((m) => m.restaurantId === wanted) ?? memberships[0];
  if (current && (current.onboardingStep >= TOTAL || current.role === 'kitchen')) redirect('/app');

  const done = current?.onboardingStep ?? 0;
  const requested = Number(searchParams.step);
  // On peut revenir sur une étape franchie (sauf la création), jamais sauter en avant.
  const step =
    current && Number.isInteger(requested) && requested >= 2 && requested <= done + 1
      ? requested
      : Math.min(done + 1, TOTAL);

  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-2 pt-6">
          <Wordmark className="text-[26px]" />
          <p className="text-[15px] font-medium text-fg-muted">
            {t('stepOf', { current: step, total: TOTAL })}
            <span className="sm:hidden"> · {t(`steps.${step}`)}</span>
          </p>
        </header>
        <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-4">
          <div>
            <h1 className="text-display-sm">{t('title')}</h1>
            <p className="mt-1 text-fg-muted">{t('subtitle')}</p>
          </div>
          <Stepper current={step} done={done} />
          {current ? (
            <StepContent step={step} restaurant={current} stripeStatus={searchParams.stripe} />
          ) : (
            <ProfileStep domain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'miaamm.app'} />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

async function StepContent({
  step,
  restaurant,
  stripeStatus,
}: {
  step: number;
  restaurant: { restaurantId: string; slug: string; name: string; role: string };
  stripeStatus?: string;
}) {
  const location = await getCurrentLocation(restaurant.restaurantId);
  if (!location) throw new Error('Établissement introuvable');
  const supabase = createClient();

  if (step === 2) {
    const { data: hours } = await supabase
      .from('opening_hours')
      .select('service, weekday, opens_at, closes_at')
      .eq('location_id', location.id)
      .eq('service', 'pickup');
    return <HoursStep schedule={scheduleFromRows(hours ?? [])} />;
  }

  const { count: productCount } = await supabase
    .from('products')
    .select('id, categories!inner(menu_id)', { count: 'exact', head: true })
    .eq('categories.menu_id', location.menu_id ?? '');

  if (step === 3) {
    return (
      <MenuStep existingCount={productCount ?? 0} aiAvailable={getAiImportEnv().mode !== 'off'} />
    );
  }

  const { data: stripe } = await createAdminClient()
    .from('restaurants')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', restaurant.restaurantId)
    .single();

  if (step === 4) {
    return (
      <PaymentsStep
        isOwner={restaurant.role === 'owner'}
        hasAccount={Boolean(stripe?.stripe_account_id)}
        chargesEnabled={Boolean(stripe?.stripe_charges_enabled)}
        returnStatus={stripeStatus}
      />
    );
  }

  const url = shopPublicUrl(restaurant.slug);
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  const { count: hoursCount } = await supabase
    .from('opening_hours')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', location.id);
  return (
    <PublishStep
      url={url}
      previewHref={`/s/${restaurant.slug}`}
      qrSvg={qrSvg}
      slug={restaurant.slug}
      summary={{
        hours: (hoursCount ?? 0) > 0,
        products: productCount ?? 0,
        card: Boolean(stripe?.stripe_charges_enabled),
        onSite: location.on_site_payment_enabled,
      }}
    />
  );
}
