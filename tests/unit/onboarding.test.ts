import { describe, expect, it, vi } from 'vitest';
import { parseGeocodeResponse } from '@/lib/geo/geocode';
import { parseMenuCsv, splitCsvLine } from '@/lib/menu-import/csv';
import { slugify } from '@/lib/onboarding/slug';

vi.mock('server-only', () => ({}));

describe('slugify', () => {
  it('produit un identifiant de sous-domaine valide', () => {
    expect(slugify('Chez Mimi')).toBe('chez-mimi');
    expect(slugify("L'Œuf à la Coque & Fils")).toBe('l-oeuf-a-la-coque-fils');
    expect(slugify('  Pizzéria   Nàpoli !! ')).toBe('pizzeria-napoli');
  });

  it('complète les noms trop courts ou réservés', () => {
    expect(slugify('A')).toBe('a-miaamm');
    expect(slugify('App')).toBe('app-miaamm');
    expect(slugify('!!!')).toBe('resto-miaamm');
  });

  it('coupe à 40 caractères sans tiret final', () => {
    const slug = slugify('Le très très long nom de restaurant du coin de la rue');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('import CSV', () => {
  it('gère les guillemets et les guillemets échappés', () => {
    expect(splitCsvLine('a;"b;c";"d ""e"""', ';')).toEqual(['a', 'b;c', 'd "e"']);
  });

  it('regroupe par catégorie, séparateur « ; », prix à la française', () => {
    const csv = [
      'Catégorie;Nom;Description;Prix',
      'Entrées;Soupe du jour;Selon le marché;6,50',
      'Plats;Burger;"Bœuf; cheddar";13,50 €',
      'Entrées;Salade;;7',
    ].join('\n');
    const result = parseMenuCsv(csv);
    expect(result).toEqual({
      ok: true,
      draft: {
        categories: [
          {
            name: 'Entrées',
            products: [
              { name: 'Soupe du jour', description: 'Selon le marché', priceCents: 650 },
              { name: 'Salade', description: '', priceCents: 700 },
            ],
          },
          {
            name: 'Plats',
            products: [{ name: 'Burger', description: 'Bœuf; cheddar', priceCents: 1350 }],
          },
        ],
      },
    });
  });

  it('accepte les en-têtes anglais et le séparateur « , »', () => {
    const result = parseMenuCsv('name,price,category\r\nFries,3.5,Sides\r\n');
    expect(result.ok && result.draft.categories[0]).toEqual({
      name: 'Sides',
      products: [{ name: 'Fries', description: '', priceCents: 350 }],
    });
  });

  it('signale les erreurs avec le numéro de ligne', () => {
    expect(parseMenuCsv('')).toEqual({ ok: false, error: { code: 'empty' } });
    expect(parseMenuCsv('foo;bar\nx;y')).toEqual({ ok: false, error: { code: 'columns' } });
    expect(parseMenuCsv('categorie;nom;prix\nA;B;douze')).toEqual({
      ok: false,
      error: { code: 'price', line: 2 },
    });
    expect(parseMenuCsv('categorie;nom;prix\nA;B;1\nA;;2')).toEqual({
      ok: false,
      error: { code: 'name', line: 3 },
    });
  });
});

describe('géocodage', () => {
  const feature = (score: number) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [2.2945, 48.8584] },
    properties: { label: '5 Avenue Anatole France 75007 Paris', score },
  });

  it('lit le meilleur résultat GeoJSON (lng, lat)', () => {
    expect(parseGeocodeResponse({ type: 'FeatureCollection', features: [feature(0.93)] })).toEqual({
      ok: true,
      lat: 48.8584,
      lng: 2.2945,
      label: '5 Avenue Anatole France 75007 Paris',
    });
  });

  it('refuse un résultat incertain ou absent', () => {
    expect(parseGeocodeResponse({ features: [feature(0.3)] })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(parseGeocodeResponse({ features: [] })).toEqual({ ok: false, error: 'not_found' });
    expect(parseGeocodeResponse({ oops: true })).toEqual({ ok: false, error: 'unavailable' });
  });
});
