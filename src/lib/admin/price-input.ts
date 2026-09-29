/** Saisie d'un prix en euros par le restaurateur : « 13,50 », « 13.5 », « 13 € » → centimes. */
export function parseEuroInput(value: string): number | null {
  const cleaned = value.replace(/[\s€]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Centimes → valeur de champ « 13,50 » (sans symbole). */
export function formatEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
