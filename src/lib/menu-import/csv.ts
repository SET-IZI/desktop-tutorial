import { parseEuroInput } from '@/lib/admin/price-input';
import type { ImportDraft } from './draft';

/**
 * Import CSV d'une carte. Colonnes attendues (en-tête obligatoire, ordre libre) :
 * catégorie, nom, prix, et description facultative. Séparateur « ; » (Excel FR)
 * ou « , », champs entre guillemets acceptés.
 */

export type CsvError =
  | { code: 'empty' }
  | { code: 'columns' }
  | { code: 'price'; line: number }
  | { code: 'name'; line: number }
  | { code: 'too_many' };

export type CsvResult = { ok: true; draft: ImportDraft } | { ok: false; error: CsvError };

const MAX_ROWS = 500;

const HEADERS: Record<'category' | 'name' | 'price' | 'description', string[]> = {
  category: ['categorie', 'category', 'rubrique', 'section'],
  name: ['nom', 'name', 'plat', 'produit', 'article'],
  price: ['prix', 'price', 'tarif'],
  description: ['description', 'desc', 'details', 'composition'],
};

const normalize = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Découpe une ligne CSV en respectant les guillemets ("" = guillemet littéral). */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseMenuCsv(text: string): CsvResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return { ok: false, error: { code: 'empty' } };
  if (lines.length - 1 > MAX_ROWS) return { ok: false, error: { code: 'too_many' } };

  const header = lines[0]!;
  const sep = (header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ';' : ',';
  const cols = splitCsvLine(header, sep).map(normalize);
  const index = (key: keyof typeof HEADERS) => cols.findIndex((c) => HEADERS[key].includes(c));
  const at = { category: index('category'), name: index('name'), price: index('price') };
  const descAt = index('description');
  if (at.category < 0 || at.name < 0 || at.price < 0) {
    return { ok: false, error: { code: 'columns' } };
  }

  const categories = new Map<string, ImportDraft['categories'][number]>();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!, sep);
    const line = i + 1;
    const name = cells[at.name] ?? '';
    if (!name || name.length > 80) return { ok: false, error: { code: 'name', line } };
    const priceCents = parseEuroInput(cells[at.price] ?? '');
    if (priceCents === null) return { ok: false, error: { code: 'price', line } };
    const categoryName = (cells[at.category] || 'Carte').slice(0, 60);
    const key = normalize(categoryName);
    if (!categories.has(key)) categories.set(key, { name: categoryName, products: [] });
    categories.get(key)!.products.push({
      name,
      description: descAt >= 0 ? (cells[descAt] ?? '').slice(0, 600) : '',
      priceCents,
    });
  }
  return { ok: true, draft: { categories: [...categories.values()] } };
}
