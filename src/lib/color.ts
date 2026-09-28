/** Utilitaires couleur : contraste WCAG et texte lisible sur un accent restaurant. */

export type Rgb = readonly [number, number, number];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Couleur hexadécimale invalide : ${hex}`);
  let h = match[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Canaux "r g b" pour les variables CSS (ex. --accent). */
export function toRgbChannels(hex: string): string {
  return hexToRgb(hex).join(' ');
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Choisit le texte (blanc ou quasi-noir) qui contraste le mieux avec le fond. */
export function readableTextOn(bg: string): '#FFFFFF' | '#1D1D1F' {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#1D1D1F') ? '#FFFFFF' : '#1D1D1F';
}
