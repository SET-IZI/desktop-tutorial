'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Rafraîchit la page serveur à intervalle régulier tant que la commande évolue.
 * Remplacé par Supabase Realtime en phase 5.
 */
export function AutoRefresh({
  intervalMs,
  maxTimes = 120,
}: {
  intervalMs: number;
  maxTimes?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      count += 1;
      if (count > maxTimes) window.clearInterval(id);
      else router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, maxTimes]);
  return null;
}
