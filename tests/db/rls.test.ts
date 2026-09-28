import { anon, createOtherRestaurant, IDS, user, withDb } from './helpers';

describe('RLS · couverture', () => {
  it('est activée sur toutes les tables du schéma public', () =>
    withDb(async (db) => {
      const rows = await db.query<{ relname: string }>(`
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
      expect(rows.map((r) => r.relname)).toEqual([]);
    }));
});

describe('RLS · visiteur anonyme (boutique)', () => {
  it('lit le catalogue d’un restaurant publié', () =>
    withDb(async (db) => {
      await db.as(anon);
      const restaurants = await db.query(`select slug from restaurants`);
      expect(restaurants).toEqual([{ slug: 'chez-mimi' }]);
      const [{ count }] = (await db.query<{ count: string }>(
        `select count(*) from products where restaurant_id = $1`,
        [IDS.restaurant],
      )) as [{ count: string }];
      expect(Number(count)).toBe(15);
      expect((await db.query(`select id from options`)).length).toBeGreaterThan(0);
      expect((await db.query(`select id from delivery_zones`)).length).toBe(3);
    }));

  it('ne voit pas le catalogue d’un restaurant non publié', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.query(`update restaurants set is_published = false where id = $1`, [
        other.restaurantId,
      ]);
      await db.as(anon);
      expect(
        await db.query(`select id from restaurants where id = $1`, [other.restaurantId]),
      ).toEqual([]);
      expect(
        await db.query(`select id from categories where restaurant_id = $1`, [other.restaurantId]),
      ).toEqual([]);
    }));

  it('ne lit aucune donnée privée', () =>
    withDb(async (db) => {
      await db.as(anon);
      for (const table of [
        'orders',
        'order_items',
        'customers',
        'loyalty_accounts',
        'promo_codes',
        'campaigns',
        'users_roles',
        'deliveries',
        'delivery_tracks',
        'delivery_events',
        'delivery_provider_logs',
        'drivers',
      ]) {
        expect(await db.query(`select * from ${table}`), table).toEqual([]);
      }
      expect(await db.fails(`select * from jobs`)).toMatch(/permission denied/);
      expect(await db.fails(`select * from provider_credentials`)).toMatch(/permission denied/);
    }));

  it('ne peut pas créer de commande ni modifier le catalogue', () =>
    withDb(async (db) => {
      await db.as(anon);
      expect(
        await db.fails(
          `insert into orders (restaurant_id, location_id, customer_name, customer_phone, fulfillment,
             subtotal_cents, total_cents, payment_method)
           values ($1, $2, 'X', '+33', 'pickup', 0, 0, 'on_site')`,
          [IDS.restaurant, IDS.location],
        ),
        // Bloqué avant même la RLS (valeur par défaut public_token non exécutable par anon).
      ).toMatch(/row-level security|permission denied/);
      await db.query(`update products set price_cents = 1 where id = $1`, [IDS.productClassique]);
      await db.asSuper();
      const [p] = await db.query<{ price_cents: number }>(
        `select price_cents from products where id = $1`,
        [IDS.productClassique],
      );
      expect(p!.price_cents).toBe(1350);
    }));

  it('peut consulter la charge des créneaux sans voir les commandes', () =>
    withDb(async (db) => {
      await db.as(anon);
      const rows = await db.query<{ orders_count: number }>(
        `select * from slot_load($1, now() - interval '1 day', now() + interval '1 day')`,
        [IDS.location],
      );
      expect(rows.reduce((n, r) => n + r.orders_count, 0)).toBe(1); // seule la commande "new" compte
    }));
});

describe('RLS · isolation entre restaurants', () => {
  it('un restaurateur ne voit ni ne modifie les données d’un autre', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);

      await db.as(user(other.ownerId));
      expect(await db.query(`select id from orders`)).toEqual([]);
      expect(await db.query(`select id from customers`)).toEqual([]);
      expect(await db.query(`select id from promo_codes`)).toEqual([]);
      expect(
        await db.query(`select id from users_roles where restaurant_id = $1`, [IDS.restaurant]),
      ).toEqual([]);

      // Écritures silencieusement filtrées par la RLS
      await db.query(`update products set price_cents = 1 where restaurant_id = $1`, [
        IDS.restaurant,
      ]);
      await db.query(`delete from categories where restaurant_id = $1`, [IDS.restaurant]);
      expect(
        await db.fails(
          `insert into promo_codes (restaurant_id, code, kind, value) values ($1, 'HACK', 'fixed', 500)`,
          [IDS.restaurant],
        ),
      ).toMatch(/row-level security/);
      expect(
        await db.fails(
          `insert into users_roles (user_id, restaurant_id, role) values ($1, $2, 'owner')`,
          [other.ownerId, IDS.restaurant],
        ),
      ).toMatch(/row-level security/);

      await db.asSuper();
      const [{ count }] = (await db.query<{ count: string }>(
        `select count(*) from categories where restaurant_id = $1`,
        [IDS.restaurant],
      )) as [{ count: string }];
      expect(Number(count)).toBe(5);

      // Et inversement
      await db.as(user(IDS.owner));
      expect(
        await db.query(`select id from categories where restaurant_id = $1`, [other.restaurantId]),
      ).toHaveLength(1); // publié : lecture publique
      await db.query(`update categories set name = 'Piratée' where restaurant_id = $1`, [
        other.restaurantId,
      ]);
      await db.asSuper();
      const [cat] = await db.query<{ name: string }>(`select name from categories where id = $1`, [
        other.categoryId,
      ]);
      expect(cat!.name).toBe('Pizzas');
    }));

  it('interdit de rattacher un produit à la catégorie d’un autre restaurant (FK composite)', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.as(user(other.ownerId));
      expect(
        await db.fails(
          `insert into products (restaurant_id, category_id, name, price_cents) values ($1, $2, 'Intrus', 100)`,
          [other.restaurantId, IDS.categoryBurgers],
        ),
      ).toMatch(/foreign key/);
    }));
});

describe('RLS · rôles de l’équipe', () => {
  it('owner : gère le catalogue et l’équipe, pas les colonnes serveur', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const updated = await db.query(
        `update products set is_sold_out = true where id = $1 returning id`,
        [IDS.productClassique],
      );
      expect(updated).toHaveLength(1);
      expect(
        await db.fails(`update restaurants set stripe_account_id = 'acct_x' where id = $1`, [
          IDS.restaurant,
        ]),
      ).toMatch(/permission denied/);
      expect(
        await db.fails(`update restaurants set order_seq = 0 where id = $1`, [IDS.restaurant]),
      ).toMatch(/permission denied/);
      const promo = await db.query(
        `insert into promo_codes (restaurant_id, code, kind, value) values ($1, 'ETE', 'fixed', 300) returning id`,
        [IDS.restaurant],
      );
      expect(promo).toHaveLength(1);
    }));

  it('owner : impossible de supprimer le dernier propriétaire', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      expect(await db.fails(`delete from users_roles where user_id = $1`, [IDS.owner])).toMatch(
        /au moins un propriétaire/,
      );
      expect(
        await db.fails(`update users_roles set role = 'manager' where user_id = $1`, [IDS.owner]),
      ).toMatch(/au moins un propriétaire/);
    }));

  it('kitchen : voit les commandes et change leur statut, rien d’autre', () =>
    withDb(async (db) => {
      await db.as(user(IDS.kitchen));
      expect(await db.query(`select id from orders`)).toHaveLength(3);
      expect(await db.query(`select id from order_items`)).toHaveLength(7);
      const accepted = await db.query(
        `update orders set status = 'accepted' where id = $1 returning status, accepted_at`,
        [IDS.orderNew],
      );
      expect(accepted[0]).toMatchObject({ status: 'accepted' });
      expect(accepted[0]!.accepted_at).not.toBeNull();

      expect(
        await db.fails(`update orders set total_cents = 0 where id = $1`, [IDS.orderNew]),
      ).toMatch(/permission denied/);
      expect(await db.query(`select id from customers`)).toEqual([]);
      expect(await db.query(`select id from promo_codes`)).toEqual([]);
      expect(await db.query(`select id from campaigns`)).toEqual([]);
      const touched = await db.query(
        `update products set price_cents = 1 where id = $1 returning id`,
        [IDS.productClassique],
      );
      expect(touched).toEqual([]);
    }));

  it('secrets provider : état visible par le manager, clé chiffrée jamais', () =>
    withDb(async (db) => {
      await db.asSuper();
      await db.query(
        `insert into provider_credentials (restaurant_id, provider, encrypted_secret, secret_hint)
         values ($1, 'shipday', 'v1.aaa.bbb.ccc', 'sd_…1234')`,
        [IDS.restaurant],
      );
      await db.as(user(IDS.owner));
      const rows = await db.query(`select provider, secret_hint, status from provider_credentials`);
      expect(rows).toEqual([{ provider: 'shipday', secret_hint: 'sd_…1234', status: 'connected' }]);
      expect(await db.fails(`select encrypted_secret from provider_credentials`)).toMatch(
        /permission denied/,
      );
      expect(await db.fails(`select * from provider_credentials`)).toMatch(/permission denied/);

      await db.as(user(IDS.kitchen));
      expect(await db.query(`select provider from provider_credentials`)).toEqual([]);
    }));
});

describe('RLS · clients', () => {
  it('un client ne voit que ses commandes et leur contenu', () =>
    withDb(async (db) => {
      await db.as(user(IDS.customer));
      const orders = await db.query<{ id: string }>(`select id from orders order by number`);
      expect(orders.map((o) => o.id)).toEqual([IDS.orderCompleted, IDS.orderDelivery]);
      const items = await db.query(`select id from order_items`);
      expect(items).toHaveLength(4);
      expect(await db.query(`select id from customers`)).toHaveLength(1);
      expect(await db.query(`select balance from loyalty_accounts`)).toEqual([{ balance: 3 }]);
      expect(await db.query(`select id from deliveries`)).toHaveLength(1);
      expect(await db.query(`select id from delivery_tracks`)).toHaveLength(6);
    }));

  it('un client ne peut pas modifier sa commande', () =>
    withDb(async (db) => {
      await db.as(user(IDS.customer));
      const rows = await db.query(
        `update orders set status = 'cancelled' where id = $1 returning id`,
        [IDS.orderDelivery],
      );
      expect(rows).toEqual([]);
    }));

  it('une session invitée (anonyme) retrouve sa commande', () =>
    withDb(async (db) => {
      const guest = '00000000-0000-4000-8000-0000000000c1';
      await db.asSuper();
      await db.query(`insert into auth.users (id, is_anonymous) values ($1, true)`, [guest]);
      await db.query(`update orders set customer_user_id = $1 where id = $2`, [
        guest,
        IDS.orderNew,
      ]);
      await db.as(user(guest, true));
      expect(await db.query(`select id from orders`)).toEqual([{ id: IDS.orderNew }]);
      expect(await db.query(`select id from order_items`)).toHaveLength(3);
    }));

  it('favoris : chacun les siens', () =>
    withDb(async (db) => {
      await db.as(user(IDS.customer));
      await db.query(
        `insert into favorites (user_id, restaurant_id, product_id) values ($1, $2, $3)`,
        [IDS.customer, IDS.restaurant, IDS.productClassique],
      );
      expect(
        await db.fails(
          `insert into favorites (user_id, restaurant_id, product_id) values ($1, $2, $3)`,
          [IDS.owner, IDS.restaurant, IDS.productClassique],
        ),
      ).toMatch(/row-level security/);
      await db.as(user(IDS.owner));
      expect(await db.query(`select * from favorites`)).toEqual([]);
    }));
});

describe('Onboarding · create_restaurant', () => {
  it('crée restaurant, menu, établissement et nomme l’appelant owner', () =>
    withDb(async (db) => {
      const newUser = '00000000-0000-4000-8000-0000000000d1';
      await db.asSuper();
      await db.query(`insert into auth.users (id, email) values ($1, 'nouveau@miaamm.test')`, [
        newUser,
      ]);
      await db.as(user(newUser));
      const [{ create_restaurant: id }] = (await db.query<{ create_restaurant: string }>(
        `select create_restaurant('Le Nouveau', 'le-nouveau', $1::jsonb)`,
        [
          JSON.stringify({
            address_line: '1 rue de Rivoli',
            postal_code: '75001',
            city: 'Paris',
            lat: 48.86,
            lng: 2.34,
          }),
        ],
      )) as [{ create_restaurant: string }];
      expect(await db.query(`select role from users_roles where restaurant_id = $1`, [id])).toEqual(
        [{ role: 'owner' }],
      );
      const [loc] = await db.query<{ menu_id: string | null }>(
        `select menu_id from locations where restaurant_id = $1`,
        [id],
      );
      expect(loc!.menu_id).not.toBeNull();
    }));

  it('refuse les sessions anonymes et les slugs invalides', () =>
    withDb(async (db) => {
      await db.as(user('00000000-0000-4000-8000-0000000000c2', true));
      expect(await db.fails(`select create_restaurant('X', 'x-resto', '{}'::jsonb)`)).toMatch(
        /Connexion requise/,
      );
      await db.as(user(IDS.owner));
      expect(
        await db.fails(
          `select create_restaurant('X', 'Pas Valide!', '{"address_line":"a","postal_code":"1","city":"c","lat":1,"lng":1}'::jsonb)`,
        ),
      ).toMatch(/check constraint/);
    }));

  it('n’est pas exécutable par un visiteur non connecté', () =>
    withDb(async (db) => {
      await db.as(anon);
      expect(await db.fails(`select create_restaurant('X', 'x-resto', '{}'::jsonb)`)).toMatch(
        /permission denied/,
      );
    }));
});

describe('RLS · brouillons invisibles du public', () => {
  it('les produits, catégories et options inactifs ne sont visibles que par l’équipe', () =>
    withDb(async (db) => {
      await db.asSuper();
      await db.query(`update products set is_active = false where id = $1`, [IDS.productClassique]);
      await db.query(
        `update categories set is_active = false where id = 'a0000000-0000-4000-8000-000000000001'`,
      );
      await db.query(`update options set is_active = false where name = 'Bacon'`);

      await db.as(anon);
      expect(
        await db.query(`select id from products where id = $1`, [IDS.productClassique]),
      ).toEqual([]);
      expect(await db.query(`select id from categories`)).toHaveLength(4);
      expect(await db.query(`select id from options where name = 'Bacon'`)).toEqual([]);

      await db.as(user(IDS.kitchen));
      expect(
        await db.query(`select id from products where id = $1`, [IDS.productClassique]),
      ).toHaveLength(1);
      expect(await db.query(`select id from categories`)).toHaveLength(5);
    }));
});
