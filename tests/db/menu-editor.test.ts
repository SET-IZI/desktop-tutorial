import { anon, createOtherRestaurant, IDS, user, withDb, type Db } from './helpers';

const BURGERS = IDS.categoryBurgers;

async function save(db: Db, payload: Record<string, unknown>) {
  const [row] = await db.query<{ save_product: string }>(`select save_product($1::jsonb)`, [
    JSON.stringify(payload),
  ]);
  return row!.save_product;
}

const base = {
  category_id: BURGERS,
  name: 'Le Fermier',
  description: 'Poulet fermier, sauce moutarde',
  price_cents: 1500,
  image_urls: [],
  diet_tags: ['new'],
  allergens: ['gluten', 'mustard'],
  groups: [
    {
      name: 'Cuisson',
      min_select: 1,
      max_select: 1,
      options: [{ name: 'Croustillant' }, { name: 'Grillé', price_delta_cents: 50 }],
    },
  ],
};

describe('save_product', () => {
  it('crée un produit avec ses options, en dernière position', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const id = await save(db, base);
      const [p] = await db.query<{ position: number; diet_tags: string; allergens: string }>(
        `select position, diet_tags::text, allergens::text from products where id = $1`,
        [id],
      );
      expect(p).toEqual({ position: 3, diet_tags: '{new}', allergens: '{gluten,mustard}' });
      const opts = await db.query(
        `select o.name, o.price_delta_cents from options o join option_groups g on g.id = o.group_id where g.product_id = $1 order by o.position`,
        [id],
      );
      expect(opts).toEqual([
        { name: 'Croustillant', price_delta_cents: 0 },
        { name: 'Grillé', price_delta_cents: 50 },
      ]);
    }));

  it('met à jour en conservant les identifiants des options existantes', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const id = await save(db, base);
      const [group] = await db.query<{ id: string }>(
        `select id from option_groups where product_id = $1`,
        [id],
      );
      const options = await db.query<{ id: string; name: string }>(
        `select id, name from options where group_id = $1 order by position`,
        [group!.id],
      );

      await save(db, {
        ...base,
        id,
        name: 'Le Fermier (nouveau)',
        groups: [
          {
            id: group!.id,
            name: 'Cuisson',
            min_select: 1,
            max_select: 1,
            options: [
              { id: options[1]!.id, name: 'Grillé', price_delta_cents: 100 }, // réordonné, prix modifié
              { name: 'Pané' }, // nouveau ; « Croustillant » supprimé
            ],
          },
        ],
      });
      const after = await db.query<{ id: string; name: string; price_delta_cents: number }>(
        `select id, name, price_delta_cents from options where group_id = $1 order by position`,
        [group!.id],
      );
      expect(after.map((o) => o.name)).toEqual(['Grillé', 'Pané']);
      expect(after[0]!.id).toBe(options[1]!.id);
      expect(after[0]!.price_delta_cents).toBe(100);
    }));

  it('supprime les groupes retirés', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const id = await save(db, base);
      await save(db, { ...base, id, groups: [] });
      expect(await db.query(`select id from option_groups where product_id = $1`, [id])).toEqual(
        [],
      );
    }));

  it('est refusé à la cuisine, aux visiteurs et à un autre restaurant', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.as(user(IDS.kitchen));
      expect(await db.fails(`select save_product($1::jsonb)`, [JSON.stringify(base)])).toMatch(
        /forbidden/,
      );
      await db.as(user(other.ownerId));
      expect(await db.fails(`select save_product($1::jsonb)`, [JSON.stringify(base)])).toMatch(
        /forbidden/,
      );
      // Un autre restaurant ne peut pas modifier un produit existant de Chez Mimi.
      expect(
        await db.fails(`select save_product($1::jsonb)`, [
          JSON.stringify({ ...base, id: IDS.productClassique, category_id: other.categoryId }),
        ]),
      ).toMatch(/product_not_found/);
      await db.as(anon);
      expect(await db.fails(`select save_product($1::jsonb)`, [JSON.stringify(base)])).toMatch(
        /permission denied/,
      );
    }));

  it('valide les contraintes (prix négatif, max < min)', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      expect(
        await db.fails(`select save_product($1::jsonb)`, [
          JSON.stringify({ ...base, price_cents: -1 }),
        ]),
      ).toMatch(/check constraint/);
      expect(
        await db.fails(`select save_product($1::jsonb)`, [
          JSON.stringify({
            ...base,
            groups: [{ name: 'X', min_select: 2, max_select: 1, options: [] }],
          }),
        ]),
      ).toMatch(/check constraint/);
    }));
});

describe('reorder', () => {
  it('réordonne les catégories et ignore celles d’un autre restaurant', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.as(user(IDS.owner));
      const ids = (
        await db.query<{ id: string }>(
          `select id from categories where restaurant_id = $1 order by position`,
          [IDS.restaurant],
        )
      ).map((r) => r.id);
      await db.query(`select reorder_categories($1::uuid[])`, [
        [...ids].reverse().concat(other.categoryId),
      ]);
      const after = (
        await db.query<{ id: string }>(
          `select id from categories where restaurant_id = $1 order by position`,
          [IDS.restaurant],
        )
      ).map((r) => r.id);
      expect(after).toEqual([...ids].reverse());
      await db.asSuper();
      const [c] = await db.query<{ position: number }>(
        `select position from categories where id = $1`,
        [other.categoryId],
      );
      expect(c!.position).toBe(0);
    }));
});
