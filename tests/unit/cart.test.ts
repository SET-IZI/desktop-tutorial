import {
  buildLine,
  cartCount,
  cartSubtotal,
  lineTotal,
  reconcileCart,
  selectionUnitPrice,
  validateSelection,
} from '@/lib/cart/lines';
import { burger, cookie, menu, tiramisu } from '../fixtures/menu';

describe('panier · sélection d’options', () => {
  it('exige les groupes obligatoires', () => {
    expect(validateSelection(burger, {})).toEqual([{ groupId: 'cuisson', kind: 'min' }]);
    expect(validateSelection(burger, { cuisson: ['saignant'] })).toEqual([]);
  });

  it('respecte le maximum et refuse les options inconnues', () => {
    expect(
      validateSelection(burger, {
        cuisson: ['saignant'],
        supplements: ['cheddar', 'bacon', 'oeuf'],
      }),
    ).toEqual([{ groupId: 'supplements', kind: 'max' }]);
    expect(validateSelection(burger, { cuisson: ['bleu'] })).toEqual([
      { groupId: 'cuisson', kind: 'unknown' },
    ]);
    expect(validateSelection(burger, { cuisson: ['saignant'], intrus: ['x'] })).toEqual([
      { groupId: 'intrus', kind: 'unknown' },
    ]);
  });

  it('calcule le prix avec suppléments', () => {
    expect(
      selectionUnitPrice(burger, { cuisson: ['apoint'], supplements: ['cheddar', 'bacon'] }),
    ).toBe(1350 + 150 + 200);
  });
});

describe('panier · lignes', () => {
  it('construit une ligne et fusionne les identiques via la clé', () => {
    const a = buildLine(
      burger,
      { cuisson: ['apoint'], supplements: ['bacon', 'cheddar'] },
      2,
      ' Sans oignons ',
    );
    const b = buildLine(
      burger,
      { supplements: ['cheddar', 'bacon'], cuisson: ['apoint'] },
      1,
      'sans oignons',
    );
    expect(a.key).toBe(b.key);
    expect(a.notes).toBe('Sans oignons');
    expect(lineTotal(a)).toBe((1350 + 350) * 2);
  });

  it('distingue deux cuissons différentes', () => {
    const a = buildLine(burger, { cuisson: ['apoint'] }, 1);
    const b = buildLine(burger, { cuisson: ['saignant'] }, 1);
    expect(a.key).not.toBe(b.key);
  });

  it('refuse un produit en rupture ou une sélection invalide', () => {
    expect(() => buildLine(cookie, {}, 1)).toThrow(/rupture/);
    expect(() => buildLine(burger, {}, 1)).toThrow(/invalide/);
  });

  it('borne la quantité entre 1 et 99', () => {
    expect(buildLine(tiramisu, {}, 500).quantity).toBe(99);
    expect(buildLine(tiramisu, {}, 0).quantity).toBe(1);
  });

  it('totalise le panier', () => {
    const lines = [buildLine(burger, { cuisson: ['apoint'] }, 2), buildLine(tiramisu, {}, 1)];
    expect(cartCount(lines)).toBe(3);
    expect(cartSubtotal(lines)).toBe(1350 * 2 + 650);
  });
});

describe('panier · réconciliation avec la carte', () => {
  it('retire les produits disparus ou en rupture et réapplique les prix du jour', () => {
    const line = buildLine(burger, { cuisson: ['apoint'], supplements: ['bacon'] }, 1);
    const stale = {
      ...line,
      basePriceCents: 999,
      options: line.options.map((o) => ({ ...o, priceDeltaCents: 1 })),
    };
    const ghost = { ...buildLine(tiramisu, {}, 1), productId: 'disparu', name: 'Plat disparu' };
    const soldOut = { ...buildLine(tiramisu, {}, 1), productId: 'cookie', name: 'Cookie géant' };

    const { lines, removed } = reconcileCart([stale, ghost, soldOut], menu);
    expect(removed).toEqual(['Plat disparu', 'Cookie géant']);
    expect(lines).toHaveLength(1);
    expect(lineTotal(lines[0]!)).toBe(1350 + 200);
  });

  it('retire une ligne dont une option n’existe plus', () => {
    const line = buildLine(burger, { cuisson: ['apoint'] }, 1);
    const broken = { ...line, options: [{ ...line.options[0]!, optionId: 'bleu' }] };
    expect(reconcileCart([broken], menu).removed).toEqual(['Le Classique']);
  });
});
