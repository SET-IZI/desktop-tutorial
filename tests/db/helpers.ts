import pg from 'pg';

/**
 * Accès base pour les tests RLS. Chaque test s'exécute dans une transaction
 * annulée à la fin : la base seedée reste intacte.
 * Les rôles et claims JWT sont posés comme le fait PostgREST.
 */

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/miaamm_test';

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

export const IDS = {
  restaurant: '11111111-1111-4111-8111-111111111111',
  location: 'd0000000-0000-4000-8000-000000000001',
  menu: '22222222-0000-4000-8000-000000000001',
  categoryBurgers: 'a0000000-0000-4000-8000-000000000002',
  productClassique: 'b0000000-0000-4000-8000-000000000201',
  owner: '00000000-0000-4000-8000-000000000001',
  kitchen: '00000000-0000-4000-8000-000000000002',
  driverUser: '00000000-0000-4000-8000-000000000003',
  customer: '00000000-0000-4000-8000-000000000004',
  orderCompleted: 'f0000000-0000-4000-8000-000000000001',
  orderNew: 'f0000000-0000-4000-8000-000000000002',
  orderDelivery: 'f0000000-0000-4000-8000-000000000003',
  delivery: '90000000-0000-4000-8000-000000000001',
} as const;

export type Actor =
  | { role: 'anon' }
  | { role: 'service_role' }
  | { role: 'authenticated'; sub: string; isAnonymous?: boolean };

export const anon: Actor = { role: 'anon' };
export const service: Actor = { role: 'service_role' };
export const user = (sub: string, isAnonymous = false): Actor => ({
  role: 'authenticated',
  sub,
  isAnonymous,
});

export interface Db {
  /** Bascule sur un rôle Supabase (anon, authenticated + claims, service_role). */
  as(actor: Actor): Promise<void>;
  /** Revient au superutilisateur (mise en place de données de test). */
  asSuper(): Promise<void>;
  query<R extends pg.QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<R[]>;
  /** Exécute une requête censée échouer et renvoie le message d'erreur. */
  fails(sql: string, params?: unknown[]): Promise<string>;
}

export async function withDb(fn: (db: Db) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  let sp = 0;
  const db: Db = {
    async as(actor) {
      await client.query('reset role');
      const claims =
        actor.role === 'authenticated'
          ? { sub: actor.sub, role: 'authenticated', is_anonymous: actor.isAnonymous ?? false }
          : { role: actor.role };
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claims),
      ]);
      await client.query(`set local role ${actor.role}`);
    },
    async asSuper() {
      await client.query('reset role');
      await client.query(`select set_config('request.jwt.claims', '', true)`);
    },
    async query(sql, params) {
      return (await client.query(sql, params)).rows;
    },
    async fails(sql, params) {
      const name = `sp_${++sp}`;
      await client.query(`savepoint ${name}`);
      try {
        await client.query(sql, params);
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`);
        return (error as Error).message;
      }
      await client.query(`release savepoint ${name}`);
      throw new Error(`La requête aurait dû échouer : ${sql}`);
    },
  };

  await client.query('begin');
  try {
    await fn(db);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

/** Crée un second restaurant publié avec son propriétaire (isolation multi-tenant). */
export async function createOtherRestaurant(db: Db) {
  await db.asSuper();
  const ownerId = '00000000-0000-4000-8000-0000000000b1';
  const restaurantId = '11111111-1111-4111-8111-1111111111b2';
  await db.query(
    `insert into auth.users (id, email, aud, role) values ($1, 'nonna@miaamm.test', 'authenticated', 'authenticated')`,
    [ownerId],
  );
  await db.query(
    `insert into public.restaurants (id, slug, name, is_published) values ($1, 'nonna', 'Nonna', true)`,
    [restaurantId],
  );
  await db.query(
    `insert into public.users_roles (user_id, restaurant_id, role) values ($1, $2, 'owner')`,
    [ownerId, restaurantId],
  );
  const [menu] = await db.query<{ id: string }>(
    `insert into public.menus (restaurant_id) values ($1) returning id`,
    [restaurantId],
  );
  const [category] = await db.query<{ id: string }>(
    `insert into public.categories (restaurant_id, menu_id, name) values ($1, $2, 'Pizzas') returning id`,
    [restaurantId, menu!.id],
  );
  return { ownerId, restaurantId, menuId: menu!.id, categoryId: category!.id };
}
