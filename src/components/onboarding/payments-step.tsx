'use client';

import { CheckCircle2, CreditCard, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { connectStripe, payOnSiteOnly } from '@/app/app/onboarding/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

interface PaymentsStepProps {
  isOwner: boolean;
  hasAccount: boolean;
  chargesEnabled: boolean;
  /** Retour de Stripe : connected | pending | incomplete | … */
  returnStatus?: string;
}

export function PaymentsStep({
  isOwner,
  hasAccount,
  chargesEnabled,
  returnStatus,
}: PaymentsStepProps) {
  const t = useTranslations('onboarding.payments');
  const to = useTranslations('onboarding');
  const router = useRouter();
  const toast = useToast();
  const [connecting, startConnect] = useTransition();
  const [skipping, startSkip] = useTransition();

  const next = () => {
    router.push('/app/onboarding');
    router.refresh();
  };

  const fail = (error: string) =>
    toast(t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.server_error'), 'error');

  const connect = () =>
    startConnect(async () => {
      // En mode Stripe, l'action redirige vers l'onboarding hébergé par Stripe.
      const result = await connectStripe();
      if (result.ok) next();
      else fail(result.error);
    });

  const status = chargesEnabled
    ? t('connected')
    : returnStatus === 'pending'
      ? t('pending')
      : hasAccount
        ? t('incomplete')
        : null;

  return (
    <Card className="p-5 sm:p-7">
      <CreditCard className="size-7 text-blue" aria-hidden />
      <h2 className="mt-3 text-[22px] font-bold tracking-display">{t('title')}</h2>
      <p className="mt-1 text-fg-muted">{t('hint')}</p>

      {status ? (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-2xl bg-fg/[0.04] px-4 py-3 font-medium"
        >
          {chargesEnabled ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
          ) : null}
          {status}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {chargesEnabled || returnStatus === 'pending' ? (
          <Button size="lg" block onClick={next}>
            {to('continue')}
          </Button>
        ) : isOwner ? (
          <>
            <Button size="lg" block onClick={connect} loading={connecting}>
              {hasAccount ? t('resume') : t('connect')}
            </Button>
            <p className="text-center text-[14px] text-fg-muted">{t('connectHint')}</p>
          </>
        ) : (
          <p className="text-fg-muted">{t('ownerOnly')}</p>
        )}
      </div>

      {!chargesEnabled ? (
        <div className="mt-6 border-t border-line/[0.08] pt-5">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden />
            <p className="text-[15px] text-fg-muted">{t('onSiteHint')}</p>
          </div>
          <Button
            variant="secondary"
            block
            className="mt-3"
            loading={skipping}
            onClick={() =>
              startSkip(async () => {
                const result = await payOnSiteOnly();
                if (result.ok) next();
                else fail(result.error);
              })
            }
          >
            {t('onSite')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
