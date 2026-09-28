'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { formatDelta, formatPrice } from '@/lib/money';

const INTL_LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-GB' };

export function useMoney(currency = 'EUR') {
  const locale = INTL_LOCALE[useLocale()] ?? 'fr-FR';
  const price = useCallback(
    (cents: number) => formatPrice(cents, currency, locale),
    [currency, locale],
  );
  const delta = useCallback(
    (cents: number) => formatDelta(cents, currency, locale),
    [currency, locale],
  );
  return { price, delta };
}
