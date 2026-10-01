'use client';

import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { removePushSubscription, savePushSubscription } from '@/app/app/(shell)/push-actions';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Alertes « nouvelle commande » sur cet appareil (Web Push), même écran cuisine fermé. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useTranslations('admin.push');
  const toast = useToast();
  const [state, setState] = useState<State>('loading');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('unsupported'));
  }, []);

  const toggle = (enable: boolean) =>
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (!enable) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await removePushSubscription(sub.endpoint);
            await sub.unsubscribe();
          }
          setState('off');
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setState(permission === 'denied' ? 'denied' : 'off');
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const result = await savePushSubscription(json);
        if (!result.ok) throw new Error('save');
        setState('on');
        toast(t('enabled'));
      } catch {
        toast(t('error'), 'error');
      }
    });

  return (
    <Card className="flex items-start gap-4">
      <BellRing className="mt-0.5 size-6 shrink-0 text-blue" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-[20px] font-bold tracking-display">{t('title')}</h2>
        <p className="mt-1 text-[15px] text-fg-muted">
          {state === 'unsupported'
            ? t('unsupported')
            : state === 'denied'
              ? t('denied')
              : t('hint')}
        </p>
      </div>
      {state === 'on' || state === 'off' ? (
        <Switch
          label={t('title')}
          checked={state === 'on'}
          disabled={pending}
          onChange={(v) => toggle(v)}
        />
      ) : null}
    </Card>
  );
}
