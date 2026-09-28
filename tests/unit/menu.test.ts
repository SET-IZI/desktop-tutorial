import { buildLine } from '@/lib/cart/lines';
import { EMPTY_FILTERS, filterMenu, normalize } from '@/lib/menu/filters';
import { suggestUpsell } from '@/lib/menu/upsell';
import { formatDelta, formatPrice } from '@/lib/money';
import { burger, curry, lemonade, menu, tiramisu } from '../fixtures/menu';

const ids = (cats: ReturnType<typeof filterMenu>) =>
  cats.flatMap((c) => c.products.map((p) => p.id));

describe('menu · recherche et filtres', () => {
  it('ignore accents et casse', () => {
    expect(normalize('Crème BRÛLÉE')).toBe('creme brulee');
    expect(normalize('Bœuf')).toBe('boeuf');
    expect(ids(filterMenu(menu, { ...EMPTY_FILTERS, query: 'legumes' }))).toEqual(['curry']);
    expect(ids(filterMenu(menu, { ...EMPTY_FILTERS, query: 'boeuf' }))).toEqual(['burger']);
  });

  it('cherche aussi dans le nom de catégorie', () => {
    expect(ids(filterMenu(menu, { ...EMPTY_FILTERS, query: 'dessert' }))).toEqual([
      'tiramisu',
      'cookie',
    ]);
  });

  it('végé inclut les plats vegan, vegan exclut les végétariens', () => {
    expect(ids(filterMenu(menu, { ...EMPTY_FILTERS, diets: ['vegetarian'] }))).toEqual([
      'vege',
      'curry',
      'tiramisu',
      'limonade',
    ]);
    expect(ids(filterMenu(menu, { ...EMPTY_FILTERS, diets: ['vegan'] }))).toEqual([
      'curry',
      'limonade',
    ]);
  });

  it('exclut les allergènes et masque les catégories vides', () => {
    const cats = filterMenu(menu, { ...EMPTY_FILTERS, excludedAllergens: ['gluten'] });
    expect(ids(cats)).toEqual(['curry', 'cookie', 'limonade']);
    expect(cats.map((c) => c.id)).toEqual(['plats', 'desserts', 'boissons']);
  });

  it('renvoie la carte telle quelle sans filtre', () => {
    expect(filterMenu(menu, EMPTY_FILTERS)).toBe(menu);
  });
});

describe('menu · upsell', () => {
  it('ne propose rien pour un panier vide', () => {
    expect(suggestUpsell(menu, [])).toEqual([]);
  });

  it('privilégie les catégories absentes du panier et ignore les ruptures', () => {
    const lines = [buildLine(burger, { cuisson: ['apoint'] }, 1)];
    expect(suggestUpsell(menu, lines).map((p) => p.id)).toEqual(['tiramisu', 'limonade']);
  });

  it('ne repropose pas ce qui est déjà dans le panier', () => {
    const lines = [buildLine(curry, {}, 1), buildLine(tiramisu, {}, 1)];
    expect(suggestUpsell(menu, lines).map((p) => p.id)).toEqual([lemonade.id]);
  });
});

describe('money', () => {
  it('formate en euros à la française', () => {
    expect(formatPrice(1450)).toMatch(/^14,50\s€$/);
    expect(formatPrice(1450, 'EUR', 'en-GB')).toBe('€14.50');
    expect(formatDelta(150)).toMatch(/^\+1,50\s€$/);
    expect(formatDelta(0)).toBe('');
  });
});
