'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { authorizeRealtime } from '@/lib/supabase/realtime';

/**
 * Suivi de commande en direct : abonnement Realtime à la commande (visible grâce
 * à la session du navigateur qui l'a passée), puis rafraîchissement de la page
 * serveur. Filet de sécurité : rafraîchissement périodique, plus fréquent tant
 * que le paiement est en cours de confirmation ou si le temps réel n'est pas
 * disponible (lien ouvert sur un autre appareil).
 */
export function LiveOrder({ orderId, confirming }: { orderId: string; confirming: boolean }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void authorizeRealtime(supabase).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`order:${orderId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          () => router.refresh(),
        )
        .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  useEffect(() => {
    const every = confirming ? 2_500 : live ? 60_000 : 15_000;
    let count = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      count += 1;
      if (count > 240) window.clearInterval(id);
      else router.refresh();
    }, every);
    return () => window.clearInterval(id);
  }, [confirming, live, router]);

  return null;
}
