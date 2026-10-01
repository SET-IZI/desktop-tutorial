'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { placeOrder, type PlaceOrderResult } from '@/app/s/[slug]/checkout/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMoney } from '@/hooks/use-money';
import { cartSubtotal, lineTotal } from '@/lib/cart/lines';
import { CartProvider, useCart, useCartMeta } from '@/lib/cart/store';
import { checkoutSchema, type CheckoutErrorCode } from '@/lib/checkout/schema';
import { readableTextOn, toRgbChannels } from '@/lib/color';
import { spring } from '@/lib/motion';
import type { IntentResult } from '@/lib/payments/gateway';
import type { Fulfillment, Storefront } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';
import { CardPayment } from './card-payment';

interface CheckoutViewProps {
  storefront: Storefront;
  cardAvailable: boolean;
  onSiteAvailable: boolean;
}

export function CheckoutView(props: CheckoutViewProps) {
  const { restaurant, location, categories } = props.storefront;
  const fulfillments = useMemo<Fulfillment[]>(
    () => [
      ...(location.pickupEnabled ? (['pickup'] as const) : []),
      ...(location.deliveryEnabled ? (['delivery'] as const) : []),
    ],
    [location.pickupEnabled, location.deliveryEnabled],
  );
  const accentStyle = {
    '--accent': toRgbChannels(restaurant.accentColor),
    '--accent-fg': toRgbChannels(readableTextOn(restaurant.accentColor)),
  } as React.CSSProperties;

  return (
    <CartProvider slug={restaurant.slug} categories={categories} fulfillments={fulfillments}>
      <div style={accentStyle} className="min-h-dvh pb-16">
        <CheckoutBody {...props} />
      </div>
    </CartProvider>
  );
}

type Step =
  { name: 'details' } | { name: 'payment'; token: string; number: number; intent: IntentResult };

type FieldErrors = Partial<Record<'firstName' | 'phone' | 'email', string>>;

function CheckoutBody({ storefront, cardAvailable, onSiteAvailable }: CheckoutViewProps) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const { restaurant, location } = storefront;
  const { price } = useMoney(restaurant.currency);
  const { hydrated } = useCartMeta();

  const lines = useCart((s) => s.lines);
  const slot = useCart((s) => s.slot);
  const fulfillment = useCart((s) => s.fulfillment);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const clearCart = useCart((s) => s.clear);

  const [step, setStep] = useState<Step>({ name: 'details' });
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [method, setMethod] = useState<'card' | 'on_site'>(cardAvailable ? 'card' : 'on_site');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = cartSubtotal(lines);
  const confirmationUrl = (token: string) => `/s/${restaurant.slug}/commande/${token}`;

  const slotLabel = useMemo(() => {
    if (!slot) return null;
    const tz = location.timezone;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' });
    const target = day.format(new Date(slot));
    const today = day.format(new Date());
    const tomorrow = day.format(new Date(Date.now() + 86_400_000));
    const dayLabel =
      target === today
        ? t('today')
        : target === tomorrow
          ? t('tomorrow')
          : new Intl.DateTimeFormat(locale, {
              timeZone: tz,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date(slot));
    const time = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(slot));
    return t('pickupAt', { day: dayLabel, time });
  }, [slot, location.timezone, locale, t]);

  const errorMessage = (code: CheckoutErrorCode, productName?: string) =>
    code === 'product_unavailable'
      ? productName
        ? t('errors.product_unavailable', { name: productName })
        : t('errors.product_unavailable_generic')
      : t(`errors.${code}`);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!slot) return;

    const input = {
      slug: restaurant.slug,
      locationId: location.id,
      fulfillment,
      slot,
      paymentMethod: method,
      locale: locale === 'en' ? ('en' as const) : ('fr' as const),
      notes,
      customer: { firstName, phone, email, marketingOptIn: marketing },
      lines: lines.map((l) => ({
        productId: l.productId,
        optionIds: l.options.map((o) => o.optionId),
        quantity: l.quantity,
        notes: l.notes,
      })),
    };

    // Validation locale d'abord (mêmes règles que le serveur), messages sous les champs.
    const local = checkoutSchema.safeParse(input);
    if (!local.success) {
      const errors: FieldErrors = {};
      for (const issue of local.error.issues) {
        const field = issue.path[1];
        if (
          issue.path[0] === 'customer' &&
          (field === 'firstName' || field === 'phone' || field === 'email')
        ) {
          errors[field] ??= t(`errors.${issue.message}` as 'errors.contact_required');
        }
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length === 0) setError(t('errors.invalid_input'));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result: PlaceOrderResult = await placeOrder(input);
      if (!result.ok) {
        setError(errorMessage(result.error, result.productName));
        return;
      }
      if (!result.payment) {
        clearCart();
        router.push(confirmationUrl(result.token));
        return;
      }
      setStep({
        name: 'payment',
        token: result.token,
        number: result.number,
        intent: result.payment,
      });
    });
  };

  if (!hydrated) return <div aria-busy className="min-h-dvh" />;

  const header = (
    <header className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Button asChild variant="secondary" size="icon" aria-label={t('back')}>
        <Link href={`/s/${restaurant.slug}`}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </Button>
      <p className="font-semibold">{restaurant.name}</p>
    </header>
  );

  if (lines.length === 0) {
    return (
      <>
        {header}
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="text-display-sm">{t('empty')}</h1>
          <p className="mt-2 text-fg-muted">{t('emptyHint')}</p>
          <Button asChild className="mt-8">
            <Link href={`/s/${restaurant.slug}`}>{t('back')}</Link>
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="mx-auto max-w-xl space-y-5 px-4 pt-6">
        <h1 className="text-display-sm">
          {step.name === 'details' ? t('title') : t('paymentTitleStep')}
        </h1>

        {/* Récapitulatif */}
        <Card className="space-y-3 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold">{t('yourOrder')}</h2>
              {slotLabel ? <p className="text-[15px] text-fg-muted">{slotLabel}</p> : null}
            </div>
            {step.name === 'details' ? (
              <Link
                href={`/s/${restaurant.slug}`}
                className="min-h-touch rounded-full px-2 py-2 text-[15px] font-semibold text-[#0062C4] dark:text-blue"
              >
                {t('edit')}
              </Link>
            ) : null}
          </div>
          <ul className="space-y-2 text-[15px]">
            {lines.map((line) => (
              <li key={line.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">
                    {line.quantity} × {line.name}
                  </span>
                  {line.options.length > 0 ? (
                    <span className="block truncate text-fg-muted">
                      {line.options.map((o) => o.name).join(' · ')}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">{price(lineTotal(line))}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-line/[0.08] pt-3 text-[17px] font-semibold">
            <span>{t('total')}</span>
            <span className="tabular-nums">{price(total)}</span>
          </p>
        </Card>

        {fulfillment === 'delivery' ? (
          <Card tone="orange" className="space-y-3 p-5">
            <p>{t('deliverySoon')}</p>
            {location.pickupEnabled ? (
              <Button variant="secondary" size="sm" onClick={() => setFulfillment('pickup')}>
                {t('switchToPickup')}
              </Button>
            ) : null}
          </Card>
        ) : !slot ? (
          <Card tone="orange" className="space-y-3 p-5">
            <p>{t('noSlot')}</p>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/s/${restaurant.slug}`}>{t('backToCart')}</Link>
            </Button>
          </Card>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {step.name === 'details' ? (
              <motion.form
                key="details"
                onSubmit={submit}
                noValidate
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={spring}
                className="space-y-5"
              >
                <Card className="space-y-4 p-5 sm:p-6">
                  <h2 className="text-[20px] font-bold tracking-display">{t('infoTitle')}</h2>
                  <Field id="firstName" label={t('firstName')} error={fieldErrors.firstName}>
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      required
                      maxLength={40}
                      className={inputClass(!!fieldErrors.firstName)}
                    />
                  </Field>
                  <p id="contact-hint" className="text-[15px] text-fg-muted">
                    {t('contactHint')}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="phone" label={t('phone')} error={fieldErrors.phone}>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        aria-describedby="contact-hint"
                        className={inputClass(!!fieldErrors.phone)}
                      />
                    </Field>
                    <Field id="email" label={t('email')} error={fieldErrors.email}>
                      <input
                        id="email"
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        aria-describedby="contact-hint"
                        className={inputClass(!!fieldErrors.email)}
                      />
                    </Field>
                  </div>
                  <Field id="notes" label={t('notes')}>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder={t('notesPlaceholder')}
                      className={cn(inputClass(false), 'h-auto resize-none py-3')}
                    />
                  </Field>
                  <label className="flex min-h-touch cursor-pointer items-center gap-3 text-[15px]">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="size-5 accent-[rgb(var(--cta))]"
                    />
                    {t('marketing', { restaurant: restaurant.name })}
                  </label>
                </Card>

                <Card className="space-y-3 p-5 sm:p-6">
                  <h2 className="text-[20px] font-bold tracking-display">{t('paymentTitle')}</h2>
                  <div role="radiogroup" aria-label={t('paymentTitle')} className="grid gap-2">
                    {cardAvailable ? (
                      <PaymentOption
                        checked={method === 'card'}
                        onSelect={() => setMethod('card')}
                        icon={<CreditCard className="size-5" aria-hidden />}
                        title={t('payNow')}
                        hint={t('payNowHint')}
                      />
                    ) : null}
                    {onSiteAvailable ? (
                      <PaymentOption
                        checked={method === 'on_site'}
                        onSelect={() => setMethod('on_site')}
                        icon={<Store className="size-5" aria-hidden />}
                        title={t('payOnSite')}
                        hint={t('payOnSiteHint')}
                      />
                    ) : null}
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
                  {method === 'card' ? t('toPayment') : t('confirm')}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={spring}
              >
                <CardPayment
                  intent={step.intent}
                  token={step.token}
                  amountLabel={price(total)}
                  returnUrl={confirmationUrl(step.token)}
                  onPaid={() => {
                    clearCart();
                    router.push(confirmationUrl(step.token));
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    'h-12 w-full rounded-2xl bg-fg/[0.06] px-4 text-body outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-blue/50',
    invalid && 'ring-2 ring-red/60',
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[14px] font-medium text-[#C00011] dark:text-red"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PaymentOption({
  checked,
  onSelect,
  icon,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex min-h-[64px] items-center gap-3 rounded-2xl px-4 text-left transition-colors',
        checked ? 'bg-cta/10 ring-2 ring-cta' : 'bg-fg/[0.04] hover:bg-fg/[0.08]',
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full',
          checked ? 'bg-cta text-cta-fg' : 'bg-fg/[0.08]',
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-[14px] text-fg-muted">{hint}</span>
      </span>
    </button>
  );
}
