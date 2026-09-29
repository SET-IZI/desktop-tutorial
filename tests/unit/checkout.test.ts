import { priceOrder } from '@/lib/checkout/price';
import { checkoutSchema } from '@/lib/checkout/schema';
import { menu } from '../fixtures/menu';

// Les fixtures utilisent des identifiants lisibles : on teste priceOrder directement.
describe('checkout · recalcul du prix', () => {
  it('calcule lignes et sous-total depuis la carte, options comprises', () => {
    const result = priceOrder(menu, [
      {
        productId: 'burger',
        optionIds: ['apoint', 'bacon', 'cheddar'],
        quantity: 2,
        notes: 'Sans oignons',
      },
      { productId: 'limonade', optionIds: [], quantity: 1, notes: '' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0]).toMatchObject({
      name: 'Le Classique',
      unit_price_cents: 1350 + 200 + 150,
      quantity: 2,
      total_cents: 3400,
      notes: 'Sans oignons',
    });
    expect(result.items[0]!.options.map((o) => o.name)).toEqual(['À point', 'Cheddar', 'Bacon']);
    expect(result.subtotalCents).toBe(3400 + 400);
  });

  it('refuse un produit épuisé, inconnu, ou des options invalides', () => {
    expect(
      priceOrder(menu, [{ productId: 'cookie', optionIds: [], quantity: 1, notes: '' }]),
    ).toMatchObject({ ok: false, productName: 'Cookie géant' });
    expect(
      priceOrder(menu, [{ productId: 'inconnu', optionIds: [], quantity: 1, notes: '' }]),
    ).toMatchObject({ ok: false });
    expect(
      priceOrder(menu, [{ productId: 'burger', optionIds: [], quantity: 1, notes: '' }]),
    ).toMatchObject({ ok: false, productName: 'Le Classique' });
    expect(
      priceOrder(menu, [
        { productId: 'burger', optionIds: ['apoint', 'autre-produit'], quantity: 1, notes: '' },
      ]),
    ).toMatchObject({ ok: false });
  });
});

describe('checkout · validation', () => {
  const base = {
    slug: 'chez-mimi',
    fulfillment: 'pickup',
    slot: '2030-01-08T11:00:00.000Z',
    paymentMethod: 'on_site',
    customer: { firstName: 'Inès', phone: '06 11 22 33 44' },
    lines: [{ productId: 'b0000000-0000-4000-8000-000000000401', optionIds: [], quantity: 1 }],
  };

  it('normalise le téléphone et accepte un email seul', () => {
    const parsed = checkoutSchema.parse(base);
    expect(parsed.customer.phone).toBe('0611223344');
    expect(
      checkoutSchema.safeParse({
        ...base,
        customer: { firstName: 'Inès', email: 'ines@example.com' },
      }).success,
    ).toBe(true);
  });

  it('exige un moyen de contact et un prénom', () => {
    expect(
      checkoutSchema.safeParse({ ...base, customer: { firstName: 'Inès', phone: '', email: '' } })
        .success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, customer: { firstName: ' ', phone: '0611223344' } })
        .success,
    ).toBe(false);
  });

  it('refuse un téléphone ou un email invalide, un panier vide, une quantité hors bornes', () => {
    expect(
      checkoutSchema.safeParse({ ...base, customer: { firstName: 'A', phone: '12' } }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, customer: { firstName: 'A', email: 'pas-un-email' } })
        .success,
    ).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, lines: [{ ...base.lines[0], quantity: 100 }] }).success,
    ).toBe(false);
  });

  it('n’accepte pas de montant venant du client', () => {
    const parsed = checkoutSchema.parse({ ...base, total: 1 });
    expect(parsed).not.toHaveProperty('total');
  });
});
