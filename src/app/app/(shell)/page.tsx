import { ArrowRight, ExternalLink, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardDescription } from '@/components/ui/card';
import { getCurrentLocation } from '@/lib/admin/location';
import { requireRestaurant } from '@/lib/auth/session';
import { formatPrice } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<string, string> = {
  new: 'bg-blue/15',
  accepted: 'bg-violet/15',
  preparing: 'bg-orange/15',
  ready: 'bg-green/15',
  completed: 'bg-fg/[0.06]',
  cancelled: 'bg-red/10',
  rejected: 'bg-red/10',
  pending_payment: 'bg-fg/[0.06]',
  in_delivery: 'bg-violet/15',
};

export default async function OverviewPage() {
  const { current } = await requireRestaurant();
  const location = await getCurrentLocation(current.restaurantId);
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const intl = locale === 'en' ? 'en-GB' : 'fr-FR';
  const tz = location?.timezone ?? 'Europe/Paris';

  // Début de la journée dans le fuseau de l'établissement.
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const supabase = createClient();
  const [{ data: recent }, { data: today }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, number, customer_name, status, total_cents, scheduled_for, payment_status, payment_method',
      )
      .eq('restaurant_id', current.restaurantId)
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('orders')
      .select('total_cents, status, scheduled_for')
      .eq('restaurant_id', current.restaurantId)
      .not('status', 'in', '(pending_payment,cancelled,rejected)')
      .gte('scheduled_for', new Date(Date.now() - 36 * 3600_000).toISOString()),
  ]);

  const todays = (today ?? []).filter(
    (o) =>
      o.scheduled_for &&
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(o.scheduled_for)) ===
        todayKey,
  );
  const revenue = todays.reduce((s, o) => s + o.total_cents, 0);
  const average = todays.length ? Math.round(revenue / todays.length) : 0;
  const price = (c: number) => formatPrice(c, 'EUR', intl);
  const time = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(intl, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
          new Date(iso),
        )
      : '';

  return (
    <div className="space-y-8">
      <h1 className="text-display-sm">{t('overview.title')}</h1>

      <section aria-labelledby="today" className="space-y-3">
        <h2 id="today" className="text-[20px] font-bold tracking-display">
          {t('overview.today')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card tone="blue" className="flex items-center gap-4 p-5 sm:block sm:p-8">
            <ShoppingBag className="size-6 text-blue" aria-hidden />
            <div>
              <p className="text-[26px] font-bold tabular-nums tracking-display sm:mt-5 sm:text-display-sm">
                {todays.length}
              </p>
              <CardDescription>{t('overview.orders', { count: todays.length })}</CardDescription>
            </div>
          </Card>
          <Card tone="green" className="flex items-center gap-4 p-5 sm:block sm:p-8">
            <TrendingUp className="size-6 text-[#1A7F37] dark:text-green" aria-hidden />
            <div>
              <p className="text-[26px] font-bold tabular-nums tracking-display sm:mt-5 sm:text-display-sm">
                {price(revenue)}
              </p>
              <CardDescription>{t('overview.revenue')}</CardDescription>
            </div>
          </Card>
          <Card tone="violet" className="flex items-center gap-4 p-5 sm:block sm:p-8">
            <Receipt className="size-6 text-violet" aria-hidden />
            <div>
              <p className="text-[26px] font-bold tabular-nums tracking-display sm:mt-5 sm:text-display-sm">
                {price(average)}
              </p>
              <CardDescription>{t('overview.average')}</CardDescription>
            </div>
          </Card>
        </div>
      </section>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className={cn(
                'size-2.5 rounded-full',
                current.isPublished ? 'bg-green' : 'bg-orange',
              )}
            />
            {t('overview.shop')} ·{' '}
            {current.isPublished ? t('overview.published') : t('overview.draft')}
          </p>
          <CardDescription>
            {current.isPublished ? t('overview.publishedHint') : t('overview.draftHint')}
          </CardDescription>
        </div>
        {current.onboardingStep < 5 ? (
          <Button asChild>
            <Link href="/app/onboarding">
              {t('overview.continueSetup')}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <a href={`/s/${current.slug}`} target="_blank" rel="noreferrer">
              {t('viewShop')}
              <ExternalLink className="size-5" aria-hidden />
            </a>
          </Button>
        )}
      </Card>

      <section aria-labelledby="latest" className="space-y-3">
        <h2 id="latest" className="text-[20px] font-bold tracking-display">
          {t('overview.latest')}
        </h2>
        {recent && recent.length > 0 ? (
          <Card className="p-2 sm:p-2">
            <ul className="divide-y divide-line/[0.06]">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <span className="w-12 shrink-0 font-bold tabular-nums">#{o.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.customer_name}</span>
                    <span className="block text-[14px] text-fg-muted">
                      {time(o.scheduled_for)} ·{' '}
                      {o.payment_status === 'paid' ? t('overview.paid') : t('overview.onSite')}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'hidden rounded-full px-2.5 py-0.5 text-[13px] font-semibold sm:inline',
                      STATUS_TONE[o.status],
                    )}
                  >
                    {t(`overview.status.${o.status}`)}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {price(o.total_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card tone="muted">
            <p className="text-fg-muted">{t('overview.noOrders')}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
