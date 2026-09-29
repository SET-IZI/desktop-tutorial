import { createOtherRestaurant, IDS, user, withDb } from './helpers';

const draft = {
  categories: [
    {
      name: 'Pâtes',
      products: [
        { name: 'Carbonara', description: 'Guanciale, pecorino', price_cents: 1400 },
        { name: 'Arrabbiata', description: '', price_cents: 1200 },
      ],
    },
    { name: 'Vins', products: [{ name: 'Chianti', description: ' ', price_cents: 600 }] },
  ],
};

describe('import_menu', () => {
  it('ajoute catégories et plats à la suite de la carte, dans l’ordre', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const [{ import_menu: count }] = (await db.query<{ import_menu: number }>(
        `select import_menu($1, $2::jsonb)`,
        [IDS.menu, JSON.stringify(draft)],
      )) as [{ import_menu: number }];
      expect(count).toBe(3);

      const cats = await db.query<{ name: string; position: number }>(
        `select name, position from categories where menu_id = $1 order by position desc limit 2`,
        [IDS.menu],
      );
      expect(cats).toEqual([
        { name: 'Vins', position: 6 },
        { name: 'Pâtes', position: 5 },
      ]);
      const products = await db.query(
        `select p.name, p.description, p.price_cents, p.position
         from products p join categories c on c.id = p.category_id
         where c.name in ('Pâtes', 'Vins') order by c.position, p.position`,
      );
      expect(products).toEqual([
        { name: 'Carbonara', description: 'Guanciale, pecorino', price_cents: 1400, position: 0 },
        { name: 'Arrabbiata', description: null, price_cents: 1200, position: 1 },
        { name: 'Chianti', description: null, price_cents: 600, position: 0 },
      ]);
    }));

  it('est refusé à la cuisine et à un autre restaurant', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.as(user(IDS.kitchen));
      expect(
        await db.fails(`select import_menu($1, $2::jsonb)`, [IDS.menu, JSON.stringify(draft)]),
      ).toMatch(/forbidden/);
      await db.as(user(other.ownerId));
      expect(
        await db.fails(`select import_menu($1, $2::jsonb)`, [IDS.menu, JSON.stringify(draft)]),
      ).toMatch(/forbidden/);
    }));
});
