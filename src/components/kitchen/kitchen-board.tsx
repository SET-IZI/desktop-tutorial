'use client';

import { ArrowLeft, Bell, BellOff, Clock, ShoppingBag, StickyNote, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { delayOrder, rejectOrder, setOrderStatus } from '@/app/app/cuisine/actions';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { useMoney } from '@/hooks/use-money';
import { playChime, unlockChime } from '@/lib/kitchen/chime';
import type { KitchenOrder } from '@/lib/kitchen/orders';
import { createClient } from '@/lib/supabase/browser';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import { cn } from '@/lib/utils';

type Column = 'new' | 'cooking' | 'ready';
const COLUMNS: Column[] = ['new', 'cooking', 'ready'];
const columnOf = (o: KitchenOrder): Column =>
  o.status === 'new' ? 'new' : o.status === 'ready' ? 'ready' : 'cooking';

const SOUND_KEY = 'miaamm:kitchen-sound';
/** Rappel sonore tant qu'une nouvelle commande attend. */
const RING_EVERY_MS = 20_000;
/** Filet de sécurité si le temps réel décroche. */
const POLL_EVERY_MS = 30_000;

interface KitchenBoardProps {
  orders: KitchenOrder[];
  locationId: string;
  locationName: string;
  timezone: string;
}

export function KitchenBoard({ orders, locationId, locationName, timezone }: KitchenBoardProps) {
  const t = useTranslations('kitchen');
  const router = useRouter();
  const toast = useToast();
  const [live, setLive] = useState(false);
  const [sound, setSound] = useState(false);
  const [tab, setTab] = useState<Column>('new');
  const [now, setNow] = useState<number | null>(null);
  // Statuts appliqués localement en attendant le rafraîchissement serveur.
  const [optimistic, setOptimistic] = useState<Record<string, KitchenOrder['status'] | 'gone'>>({});

  const visible = useMemo(
    () =>
      orders
        .map((o) =>
          optimistic[o.id] ? { ...o, status: optimistic[o.id] as KitchenOrder['status'] } : o,
        )
        .filter((o) => (optimistic[o.id] as string) !== 'gone'),
    [orders, optimistic],
  );
  const byColumn = useMemo(() => {
    const groups: Record<Column, KitchenOrder[]> = { new: [], cooking: [], ready: [] };
    for (const o of visible) groups[columnOf(o)].push(o);
    return groups;
  }, [visible]);

  // Données serveur fraîches : on oublie les états optimistes.
  useEffect(() => setOptimistic({}), [orders]);

  // Horloge pour les délais relatifs (après montage : pas d'écart SSR).
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Son : préférence mémorisée, mais le navigateur exige un geste à chaque visite.
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === 'on') {
        const unlock = () => {
          void unlockChime().then(setSound);
          window.removeEventListener('pointerdown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        return () => window.removeEventListener('pointerdown', unlock);
      }
    } catch {
      // Stockage indisponible : le bouton reste proposé.
    }
  }, []);

  const toggleSound = async () => {
    if (sound) {
      setSound(false);
      try {
        localStorage.setItem(SOUND_KEY, 'off');
      } catch {}
      return;
    }
    const ok = await unlockChime();
    setSound(ok);
    if (ok) {
      playChime();
      try {
        localStorage.setItem(SOUND_KEY, 'on');
      } catch {}
    }
  };

  // Nouvelle commande arrivée → carillon + annonce.
  const knownNew = useRef<Set<string> | null>(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === 'new').map((o) => o.id));
    if (knownNew.current) {
      const fresh = orders.find((o) => o.status === 'new' && !knownNew.current!.has(o.id));
      if (fresh) {
        if (sound) playChime();
        setAnnounce(t('newOrder', { number: fresh.number }));
      }
    }
    knownNew.current = ids;
  }, [orders, sound, t]);

  // Rappel tant qu'une commande attend d'être acceptée.
  const waiting = byColumn.new.length > 0;
  useEffect(() => {
    if (!sound || !waiting) return;
    const id = window.setInterval(playChime, RING_EVERY_MS);
    return () => window.clearInterval(id);
  }, [sound, waiting]);

  // Temps réel : chaque changement sur les commandes de l'établissement rafraîchit l'écran.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void authorizeRealtime(supabase).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`kitchen:${locationId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `location_id=eq.${locationId}` },
          () => router.refresh(),
        )
        .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    });
    const poll = window.setInterval(() => router.refresh(), POLL_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [locationId, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/[0.06] bg-bg/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/app"
            aria-label={t('back')}
            className="flex size-11 items-center justify-center rounded-full bg-fg/[0.06]"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold tracking-display">{t('title')}</h1>
            <p className="truncate text-[14px] text-fg-muted">{locationName}</p>
          </div>
          <ThemeToggle className="bg-fg/[0.06] shadow-none sm:order-last" />
          {/* Mobile : état et son sur leur propre ligne. */}
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
            <span
              role="status"
              className="flex items-center gap-2 rounded-full bg-fg/[0.06] px-3 py-2 text-[14px] font-semibold"
            >
              <span
                aria-hidden
                className={cn(
                  'size-2.5 rounded-full',
                  live ? 'bg-green' : 'animate-pulse bg-orange',
                )}
              />
              {live ? t('live') : t('reconnecting')}
            </span>
            <Button
              variant={sound ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => void toggleSound()}
              aria-pressed={sound}
            >
              {sound ? (
                <Bell className="size-4" aria-hidden />
              ) : (
                <BellOff className="size-4" aria-hidden />
              )}
              {sound ? t('soundOn') : t('soundOff')}
            </Button>
          </div>
        </div>
        {!sound ? (
          <p className="px-4 pb-3 text-[14px] text-fg-muted sm:px-6">{t('soundHint')}</p>
        ) : null}
      </header>

      <p aria-live="assertive" className="sr-only">
        {announce}
      </p>

      <div className="px-4 pt-4 lg:hidden">
        <Segmented
          size="sm"
          label={t('columnsLabel')}
          value={tab}
          onChange={setTab}
          options={COLUMNS.map((c) => ({
            value: c,
            label: `${t(`columns.${c}`)} ${byColumn[c].length}`,
          }))}
        />
      </div>

      <main className="grid flex-1 gap-4 p-4 sm:px-6 lg:grid-cols-3">
        {COLUMNS.map((column) => (
          <section
            key={column}
            aria-labelledby={`col-${column}`}
            className={cn('min-w-0 space-y-3', column !== tab && 'max-lg:hidden')}
          >
            <h2
              id={`col-${column}`}
              className="flex items-center gap-2 text-[18px] font-bold max-lg:sr-only"
            >
              {t(`columns.${column}`)}
              <span className="rounded-full bg-fg/[0.08] px-2 text-[15px] tabular-nums">
                {byColumn[column].length}
              </span>
            </h2>
            {byColumn[column].length === 0 ? (
              <p className="rounded-bento-sm bg-fg/[0.03] px-4 py-8 text-center text-fg-muted">
                {t(`empty.${column}`)}
              </p>
            ) : (
              byColumn[column].map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  timezone={timezone}
                  onDone={(status) => setOptimistic((s) => ({ ...s, [order.id]: status }))}
                  onError={(stale) => {
                    toast(stale ? t('toasts.stale') : t('toasts.error'), 'error');
                    router.refresh();
                  }}
                />
              ))
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

function OrderCard({
  order,
  now,
  timezone,
  onDone,
  onError,
}: {
  order: KitchenOrder;
  now: number | null;
  timezone: string;
  onDone: (status: KitchenOrder['status'] | 'gone') => void;
  onError: (stale: boolean) => void;
}) {
  const t = useTranslations('kitchen');
  const locale = useLocale();
  const toast = useToast();
  const { price } = useMoney();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<'sold_out' | 'too_busy' | 'closed' | 'other'>('sold_out');

  const due = order.scheduledFor
    ? new Date(order.scheduledFor).getTime() + order.extraMinutes * 60_000
    : null;
  const time = due
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }).format(due)
    : null;
  const minutes = due !== null && now !== null ? Math.round((due - now) / 60_000) : null;
  const late = minutes !== null && minutes < 0;

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    next: KitchenOrder['status'] | 'gone',
    toastKey: 'accepted' | 'ready' | 'completed' | 'rejected' | 'delayed',
  ) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        onDone(next);
        toast(t(`toasts.${toastKey}`, { number: order.number }));
      } else onError(result.error === 'stale');
    });

  return (
    <article
      aria-label={t('order', { number: order.number })}
      className={cn(
        'rounded-bento-sm bg-surface p-4 shadow-soft',
        order.status === 'new' && 'ring-2 ring-blue/60',
        late && order.status !== 'ready' && 'ring-2 ring-red/60',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[28px] font-extrabold tabular-nums leading-none tracking-display">
            {t('number', { number: order.number })}
          </p>
          <p className="mt-1 truncate text-[17px] font-semibold">{order.customerName}</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-[17px] font-bold tabular-nums">
            <Clock className="size-4" aria-hidden />
            {time ? t('at', { time }) : t('asap')}
          </p>
          {minutes !== null ? (
            <p
              className={cn(
                'text-[14px] font-semibold',
                late ? 'text-[#C00011] dark:text-red' : 'text-fg-muted',
              )}
            >
              {minutes === 0
                ? t('now')
                : late
                  ? t('lateBy', { minutes: -minutes })
                  : t('inMinutes', { minutes })}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[13px] font-semibold">
        <span className="flex items-center gap-1 rounded-full bg-fg/[0.06] px-2.5 py-1">
          <ShoppingBag className="size-3.5" aria-hidden />
          {t(order.fulfillment)}
        </span>
        {order.paymentStatus === 'paid' ? (
          <span className="rounded-full bg-green/15 px-2.5 py-1">{t('paid')}</span>
        ) : (
          <span className="rounded-full bg-orange/15 px-2.5 py-1">
            {t('toCollect', { amount: price(order.totalCents) })}
          </span>
        )}
        {order.extraMinutes > 0 ? (
          <span className="rounded-full bg-fg/[0.06] px-2.5 py-1">
            {t('delayed', { minutes: order.extraMinutes })}
          </span>
        ) : null}
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-line/[0.08] pt-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <p className="text-[17px]">
              <span className="font-bold tabular-nums">{item.quantity}×</span> {item.name}
            </p>
            {item.options.length > 0 ? (
              <p className="pl-6 text-[15px] text-fg-muted">{item.options.join(' · ')}</p>
            ) : null}
            {item.notes ? (
              <p className="pl-6 text-[15px] font-semibold italic">« {item.notes} »</p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="mt-3 flex gap-2 rounded-2xl bg-orange/10 px-3 py-2 text-[15px]">
          <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">{t('orderNotes')} : </span>
            {order.notes}
          </span>
        </p>
      ) : null}

      {rejecting ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-red/[0.06] p-3">
          <p className="font-semibold">{t('rejectTitle', { number: order.number })}</p>
          <div
            role="radiogroup"
            aria-label={t('rejectTitle', { number: order.number })}
            className="flex flex-wrap gap-2"
          >
            {(['sold_out', 'too_busy', 'closed', 'other'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className="min-h-touch rounded-full bg-fg/[0.06] px-4 text-[15px] font-semibold aria-checked:bg-fg aria-checked:text-bg"
              >
                {t(`reasons.${r}`)}
              </button>
            ))}
          </div>
          <p className="text-[14px] text-fg-muted">{t('rejectHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                run(() => rejectOrder({ orderId: order.id, reason }), 'gone', 'rejected')
              }
            >
              {t('confirmReject')}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              <X className="size-4" aria-hidden />
              {t('keep')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === 'new' ? (
            <>
              <Button
                size="lg"
                className="flex-1"
                loading={pending}
                onClick={() =>
                  run(
                    () => setOrderStatus({ orderId: order.id, to: 'accepted' }),
                    'accepted',
                    'accepted',
                  )
                }
              >
                {t('accept')}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setRejecting(true)}>
                {t('reject')}
              </Button>
            </>
          ) : order.status === 'ready' ? (
            <Button
              size="lg"
              className="flex-1"
              loading={pending}
              onClick={() =>
                run(
                  () => setOrderStatus({ orderId: order.id, to: 'completed' }),
                  'gone',
                  'completed',
                )
              }
            >
              {t('completed')}
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                className="flex-1"
                loading={pending}
                onClick={() =>
                  run(() => setOrderStatus({ orderId: order.id, to: 'ready' }), 'ready', 'ready')
                }
              >
                {t('ready')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                aria-label={t('delayLabel', { number: order.number })}
                disabled={pending}
                onClick={() =>
                  run(() => delayOrder({ orderId: order.id, minutes: 10 }), order.status, 'delayed')
                }
              >
                {t('delay')}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setRejecting(true)}>
                {t('cancel')}
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
