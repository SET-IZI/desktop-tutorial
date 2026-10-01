import { ArrowLeft, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { LiveOrder } from '@/components/order/live-order';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { formatPrice } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface Props {
  params: { slug: string; token: string };
}

type View = 'pending' | 'failed' | 'received' | 'cooking' | 'ready' | 'done' | 'cancelled';

const TERMINAL: View[] = ['done', 'cancelled', 'failed'];

export default async function OrderPage({ params }: Props) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(params.token)) notFound();

  // Accès par jeton public (non devinable) : lecture serveur, jamais exposée au client.
  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select(
      `id, number, status, payment_method, payment_status, scheduled_for, extra_minutes, cancel_reason, total_cents, customer_name, tracking_expires_at,
       order_items ( name, quantity, options, total_cents ),
       locations ( name, address_line, postal_code, city, timezone, restaurants ( slug, name, currency ) )`,
    )
    .eq('public_token', params.token)
    .maybeSingle();
  const restaurant = order?.locations?.restaurants;
  if (!order?.locations || !restaurant || restaurant.slug !== params.slug) notFound();

  const t = await getTranslations('order');
  const locale = await getLocale();
  const intlLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const location = order.locations;
  const price = (cents: number) => formatPrice(cents, restaurant.currency, intlLocale);

  const view: View =
    order.status === 'pending_payment'
      ? order.payment_status === 'failed'
        ? 'failed'
        : 'pending'
      : order.status === 'new'
        ? 'received'
        : order.status === 'accepted' || order.status === 'preparing'
          ? 'cooking'
          : order.status === 'ready'
            ? 'ready'
            : order.status === 'completed' || order.status === 'in_delivery'
              ? 'done'
              : 'cancelled';

  const headline: Record<View, [string, string]> = {
    pending: [t('pending'), t('pendingHint')],
    failed: [t('failed'), t('failedHint')],
    received: [t('received'), t('receivedHint', { restaurant: restaurant.name })],
    cooking: [t('cooking'), t('cookingHint')],
    ready: [t('ready'), t('readyHint', { restaurant: restaurant.name })],
    done: [t('done'), t('doneHint', { restaurant: restaurant.name })],
    cancelled: [
      t('cancelled'),
      [
        order.cancel_reason && ['sold_out', 'too_busy', 'closed'].includes(order.cancel_reason)
          ? t(`cancelledReasons.${order.cancel_reason as 'sold_out'}`, {
              restaurant: restaurant.name,
            })
          : t('cancelledGeneric', { restaurant: restaurant.name }),
        order.payment_status === 'refunded' ? t('refunded') : null,
      ]
        .filter(Boolean)
        .join(' '),
    ],
  };
  const progress = { received: 1, cooking: 2, ready: 3, done: 3 } as Partial<Record<View, number>>;
  const step = progress[view];

  // Retard annoncé par la cuisine : l'heure de retrait affichée suit.
  const due = order.scheduled_for
    ? new Date(new Date(order.scheduled_for).getTime() + order.extra_minutes * 60_000)
    : null;
  const when = due
    ? t('pickupWhen', {
        day: new Intl.DateTimeFormat(intlLocale, {
          timeZone: location.timezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(due),
        time: new Intl.DateTimeFormat(intlLocale, {
          timeZone: location.timezone,
          hour: '2-digit',
          minute: '2-digit',
        }).format(due),
      })
    : null;

  return (
    <div className="relative min-h-dvh overflow-hidden pb-16">
      <MeshGradient
        colors={view === 'ready' ? ['green', 'blue', 'green'] : ['orange', 'pink', 'violet']}
      />
      {!TERMINAL.includes(view) ? (
        <LiveOrder orderId={order.id} confirming={view === 'pending'} />
      ) : null}

      <header className="relative mx-auto flex max-w-xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button asChild variant="secondary" size="icon" aria-label={t('backToMenu')}>
          <Link href={`/s/${restaurant.slug}`}>
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        </Button>
        <p className="font-semibold">{restaurant.name}</p>
      </header>

      <main className="relative mx-auto max-w-xl space-y-5 px-4 pt-10">
        <div role="status" aria-live="polite">
          <p className="text-[15px] font-semibold uppercase tracking-wider text-fg">
            {t('title', { number: order.number })}
          </p>
          <h1 className="mt-2 text-balance text-display-sm sm:text-display-md">
            {headline[view][0]}
          </h1>
          <p className="mt-2 text-[17px] text-fg">{headline[view][1]}</p>
        </div>

        {step ? (
          <ol className="grid grid-cols-3 gap-2" aria-label={t('title', { number: order.number })}>
            {(['received', 'cooking', 'ready'] as const).map((key, i) => (
              <li
                key={key}
                className="space-y-2"
                aria-current={i + 1 === step ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full',
                    i < step ? (step === 3 ? 'bg-green' : 'bg-cta') : 'bg-fg/10',
                  )}
                />
                <span
                  className={cn(
                    // Texte sur dégradé : toujours text-fg (contraste AA) ; l'état se lit
                    // à la barre colorée et à la graisse.
                    'block text-[14px] text-fg',
                    i < step ? 'font-bold' : 'font-medium',
                  )}
                >
                  {t(`steps.${key}`)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <Card className="space-y-4 p-5 sm:p-6">
          {when ? (
            <div>
              <p className="text-[14px] font-semibold uppercase tracking-wider text-fg-muted">
                {t('pickup')}
              </p>
              <p className="capitalize-first mt-1 text-[20px] font-bold">{when}</p>
              {order.extra_minutes > 0 && (view === 'received' || view === 'cooking') ? (
                <p className="mt-1 text-[15px] font-medium">
                  {t('delayed', { minutes: order.extra_minutes })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wider text-fg-muted">
              {t('where')}
            </p>
            <p className="mt-1 flex items-start gap-1.5">
              <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
              <span>
                {location.name}
                <br />
                {location.address_line}, {location.postal_code} {location.city}
              </span>
            </p>
          </div>
        </Card>

        <Card className="space-y-3 p-5 sm:p-6">
          <p className="text-[14px] font-semibold uppercase tracking-wider text-fg-muted">
            {t('details')}
          </p>
          <ul className="space-y-2 text-[15px]">
            {order.order_items.map((item, i) => {
              const options = Array.isArray(item.options)
                ? (item.options as { name?: string }[]).map((o) => o.name).filter(Boolean)
                : [];
              return (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium">
                      {item.quantity} × {item.name}
                    </span>
                    {options.length > 0 ? (
                      <span className="block text-fg-muted">{options.join(' · ')}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{price(item.total_cents)}</span>
                </li>
              );
            })}
          </ul>
          <p className="flex justify-between border-t border-line/[0.08] pt-3 text-[17px] font-semibold">
            <span>{t('total')}</span>
            <span className="tabular-nums">{price(order.total_cents)}</span>
          </p>
          <p className="text-[15px] text-fg-muted">
            {order.payment_status === 'paid'
              ? t('paidOnline')
              : order.payment_method === 'on_site'
                ? t('payOnSite')
                : null}
          </p>
        </Card>

        <Button asChild variant={TERMINAL.includes(view) ? 'primary' : 'secondary'} block>
          <Link href={`/s/${restaurant.slug}`}>
            {view === 'done' || view === 'failed' ? t('orderAgain') : t('backToMenu')}
          </Link>
        </Button>
      </main>
    </div>
  );
}
