import { isValidSlug } from '@/lib/tenant';

/** « Chez Mimi & Fils » → « chez-mimi-fils » (3 à 40 caractères, sans accents). */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  if (base.length >= 3 && isValidSlug(base)) return base;
  const padded = `${base || 'resto'}-miaamm`.replace(/^-+/, '').slice(0, 40);
  return isValidSlug(padded) ? padded : 'mon-restaurant';
}
