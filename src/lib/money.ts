/** Formatage des montants (toujours en centimes entiers dans le code). */

const formatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  const key = `${locale}:${currency}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatters.set(key, fmt);
  }
  return fmt.format(cents / 100);
}

/** "+1,50 €" pour un supplément, chaîne vide si gratuit. */
export function formatDelta(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  return cents > 0 ? `+${formatPrice(cents, currency, locale)}` : '';
}
