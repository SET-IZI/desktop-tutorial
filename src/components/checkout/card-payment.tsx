'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type Stripe } from '@stripe/stripe-js';
import { FlaskConical, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { IntentResult } from '@/lib/payments/gateway';
import { effectiveTheme } from '@/lib/theme';

interface CardPaymentProps {
  intent: IntentResult;
  token: string;
  amountLabel: string;
  /** URL de confirmation (retour après authentification 3-D Secure). */
  returnUrl: string;
  onPaid: () => void;
}

export function CardPayment(props: CardPaymentProps) {
  return props.intent.mode === 'stripe' ? (
    <StripePayment {...props} intent={props.intent} />
  ) : (
    <MockPayment {...props} />
  );
}

// ═══ Stripe (direct charge sur le compte du restaurant) ══════════════════════

const stripePromises = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string, stripeAccount: string) {
  const key = `${publishableKey}:${stripeAccount}`;
  let promise = stripePromises.get(key);
  if (!promise) {
    // stripeAccount : le paiement est créé sur le compte connecté du restaurateur.
    promise = loadStripe(publishableKey, { stripeAccount });
    stripePromises.set(key, promise);
  }
  return promise;
}

function StripePayment({
  intent,
  amountLabel,
  returnUrl,
  onPaid,
}: CardPaymentProps & { intent: Extract<IntentResult, { mode: 'stripe' }> }) {
  const stripePromise = getStripePromise(intent.publishableKey, intent.stripeAccount);
  const appearance = useMemo<Appearance>(
    () => ({
      theme: effectiveTheme() === 'dark' ? 'night' : 'stripe',
      variables: { colorPrimary: '#0071E3', borderRadius: '14px', fontSizeBase: '16px' },
    }),
    [],
  );
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
      <StripeForm amountLabel={amountLabel} returnUrl={returnUrl} onPaid={onPaid} />
    </Elements>
  );
}

function StripeForm({
  amountLabel,
  returnUrl,
  onPaid,
}: {
  amountLabel: string;
  returnUrl: string;
  onPaid: () => void;
}) {
  const t = useTranslations('checkout');
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: new URL(returnUrl, window.location.origin).toString() },
      // Redirection seulement si le moyen de paiement l'exige (3-D Secure, etc.).
      redirect: 'if_required',
    });
    if (stripeError) {
      // Message de Stripe (déjà localisé et compréhensible), sinon message générique.
      setError(stripeError.message ?? t('errors.payment_failed'));
      setPending(false);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="p-5 sm:p-6">
        <PaymentElement options={{ layout: 'tabs' }} />
      </Card>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red/10 px-4 py-3 text-[15px] font-medium text-[#C00011] dark:text-red"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" block size="lg" loading={pending} disabled={!stripe}>
        {t('pay', { amount: amountLabel })}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-[14px] text-fg-muted">
        <Lock className="size-4" aria-hidden />
        {t('secure')}
      </p>
    </form>
  );
}

// ═══ Paiement simulé (dev / E2E) ═════════════════════════════════════════════

function MockPayment({ token, amountLabel, onPaid }: CardPaymentProps) {
  const t = useTranslations('checkout');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch('/api/checkout/mock-confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    if (!res?.ok) {
      setError(t('errors.payment_failed'));
      setPending(false);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={pay} className="space-y-5">
      <Card className="space-y-4 p-5 sm:p-6">
        <p className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-5 text-violet" aria-hidden />
          {t('mockTitle')}
        </p>
        <p className="text-[15px] text-fg-muted">{t('mockHint')}</p>
        <div className="rounded-2xl bg-fg/[0.06] px-4 py-3 font-mono text-[15px] tabular-nums">
          <span className="sr-only">{t('mockCard')} : </span>4242 4242 4242 4242 · 12/34 · 123
        </div>
      </Card>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red/10 px-4 py-3 text-[15px] font-medium text-[#C00011] dark:text-red"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" block size="lg" loading={pending}>
        {t('pay', { amount: amountLabel })}
      </Button>
    </form>
  );
}
