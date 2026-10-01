import { describe, expect, it } from 'vitest';
import { withLocation } from '@/lib/storefront/location';
import type { Storefront, StoreLocation } from '@/lib/storefront/types';

const loc = (id: string, name: string) => ({ id, name }) as StoreLocation;
const a = loc('a', 'Oberkampf');
const b = loc('b', 'Bastille');
const shop = { location: a, locations: [a, b] } as unknown as Storefront;

describe('withLocation', () => {
  it('affiche l’établissement demandé', () => {
    expect(withLocation(shop, 'b').location).toBe(b);
  });

  it('retombe sur l’établissement par défaut si inconnu, inactif ou absent', () => {
    expect(withLocation(shop, 'zzz')).toBe(shop);
    expect(withLocation(shop, null)).toBe(shop);
    expect(withLocation(shop).location).toBe(a);
  });
});
