import { anon, IDS, service, user, withDb } from './helpers';

const insertOrder = `
  insert into orders (restaurant_id, location_id, customer_name, customer_phone, fulfillment,
    status, subtotal_cents, total_cents, payment_method, payment_status)
  values ($1, $2, 'Test', '+33600000000', 'pickup', $3, 1000, 1000, 'card', 'pending')
  returning id, number, public_token`;

describe('Commandes · numérotation', () => {
  it('attribue des numéros séquentiels par restaurant', () =>
    withDb(async (db) => {
      await db.as(service);
      const [a] = await db.query<{ number: number; public_token: string }>(insertOrder, [
        IDS.restaurant,
        IDS.location,
        'pending_payment',
      ]);
      const [b] = await db.query<{ number: number }>(insertOrder, [
        IDS.restaurant,
        IDS.location,
        'pending_payment',
      ]);
      expect(a!.number).toBe(4); // 3 commandes dans le seed
      expect(b!.number).toBe(5);
      expect(a!.public_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    }));
});

describe('Commandes · cycle de vie', () => {
  it('refuse les transitions interdites', () =>
    withDb(async (db) => {
      await db.as(user(IDS.kitchen));
      expect(
        await db.fails(`update orders set status = 'completed' where id = $1`, [IDS.orderNew]),
      ).toMatch(/Transition de commande interdite/);
      expect(
        await db.fails(`update orders set status = 'new' where id = $1`, [IDS.orderCompleted]),
      ).toMatch(/Transition de commande interdite/);
    }));

  it('horodate chaque étape et expire le lien de suivi à la fin', () =>
    withDb(async (db) => {
      await db.as(user(IDS.kitchen));
      for (const status of ['accepted', 'preparing', 'ready', 'completed']) {
        await db.query(`update orders set status = $1 where id = $2`, [status, IDS.orderNew]);
      }
      const [o] = await db.query<Record<string, Date | null>>(
        `select accepted_at, ready_at, completed_at, tracking_expires_at from orders where id = $1`,
        [IDS.orderNew],
      );
      expect(Object.values(o!).every((v) => v instanceof Date)).toBe(true);
    }));

  it('seul le serveur confirme un paiement (pending_payment → new)', () =>
    withDb(async (db) => {
      await db.as(service);
      const [order] = await db.query<{ id: string }>(insertOrder, [
        IDS.restaurant,
        IDS.location,
        'pending_payment',
      ]);
      await db.as(user(IDS.owner));
      expect(await db.fails(`update orders set status = 'new' where id = $1`, [order!.id])).toMatch(
        /Paiement non confirmé/,
      );
      await db.as(service);
      const [placed] = await db.query<{ placed_at: Date | null }>(
        `update orders set status = 'new', payment_status = 'paid' where id = $1 returning placed_at`,
        [order!.id],
      );
      expect(placed!.placed_at).toBeInstanceOf(Date);
    }));

  it('vérifie la cohérence des montants', () =>
    withDb(async (db) => {
      await db.as(service);
      expect(
        await db.fails(
          `insert into orders (restaurant_id, location_id, customer_name, customer_phone, fulfillment,
             subtotal_cents, delivery_fee_cents, total_cents, payment_method)
           values ($1, $2, 'X', '+33', 'pickup', 1000, 200, 1000, 'card')`,
          [IDS.restaurant, IDS.location],
        ),
      ).toMatch(/check constraint/);
    }));

  it('exige une adresse géolocalisée pour une livraison', () =>
    withDb(async (db) => {
      await db.as(service);
      expect(
        await db.fails(
          `insert into orders (restaurant_id, location_id, customer_name, customer_phone, fulfillment,
             subtotal_cents, total_cents, payment_method)
           values ($1, $2, 'X', '+33', 'delivery', 1000, 1000, 'card')`,
          [IDS.restaurant, IDS.location],
        ),
      ).toMatch(/check constraint/);
    }));

  it('les paniers en attente de paiement réservent leur créneau 15 minutes', () =>
    withDb(async (db) => {
      await db.as(service);
      const slot = '2030-01-01T12:00:00Z';
      const [fresh] = await db.query<{ id: string }>(insertOrder, [
        IDS.restaurant,
        IDS.location,
        'pending_payment',
      ]);
      const [stale] = await db.query<{ id: string }>(insertOrder, [
        IDS.restaurant,
        IDS.location,
        'pending_payment',
      ]);
      await db.asSuper();
      await db.query(`update orders set scheduled_for = $1 where id in ($2, $3)`, [
        slot,
        fresh!.id,
        stale!.id,
      ]);
      await db.query(`update orders set created_at = now() - interval '20 minutes' where id = $1`, [
        stale!.id,
      ]);
      await db.as(anon);
      const rows = await db.query(
        `select orders_count from slot_load($1, $2::timestamptz, $2::timestamptz + interval '1 minute')`,
        [IDS.location, slot],
      );
      expect(rows).toEqual([{ orders_count: 1 }]);
    }));
});

describe('Livraison · livreur', () => {
  it('le livreur affecté voit sa course et enregistre sa position', () =>
    withDb(async (db) => {
      await db.as(user(IDS.driverUser));
      expect(await db.query(`select id from deliveries`)).toEqual([{ id: IDS.delivery }]);
      expect(await db.query(`select id from drivers`)).toHaveLength(1); // sa fiche seulement
      const inserted = await db.query(
        `insert into delivery_tracks (restaurant_id, delivery_id, lat, lng, heading) values ($1, $2, 48.864, 2.371, 180) returning id`,
        [IDS.restaurant, IDS.delivery],
      );
      expect(inserted).toHaveLength(1);
    }));

  it('personne d’autre ne peut écrire de position, ni le livreur une fois livré', () =>
    withDb(async (db) => {
      const track = `insert into delivery_tracks (restaurant_id, delivery_id, lat, lng) values ($1, $2, 48.86, 2.37)`;
      await db.as(user(IDS.customer));
      expect(await db.fails(track, [IDS.restaurant, IDS.delivery])).toMatch(/row-level security/);
      await db.as(user(IDS.owner));
      expect(await db.fails(track, [IDS.restaurant, IDS.delivery])).toMatch(/row-level security/);

      await db.as(service);
      await db.query(`update deliveries set status = 'delivered' where id = $1`, [IDS.delivery]);
      await db.as(user(IDS.driverUser));
      expect(await db.fails(track, [IDS.restaurant, IDS.delivery])).toMatch(/row-level security/);
    }));

  it('un livreur rejoint le restaurant avec un code d’invitation, une seule fois', () =>
    withDb(async (db) => {
      const newDriver = '00000000-0000-4000-8000-0000000000e1';
      await db.asSuper();
      await db.query(`insert into auth.users (id, email) values ($1, 'nadia@miaamm.test')`, [
        newDriver,
      ]);
      await db.as(user(newDriver));
      const [{ redeem_driver_invite: id }] = (await db.query<{ redeem_driver_invite: string }>(
        `select redeem_driver_invite('DEMO-NADIA')`,
      )) as [{ redeem_driver_invite: string }];
      expect(id).toBe('80000000-0000-4000-8000-000000000002');
      expect(await db.query(`select display_name from drivers`)).toEqual([
        { display_name: 'Nadia' },
      ]);
      expect(await db.fails(`select redeem_driver_invite('DEMO-NADIA')`)).toMatch(
        /invalide ou expiré/,
      );
    }));
});

describe('Livraison · gestion des livreurs', () => {
  it('un manager invite un livreur mais ne peut pas lier un compte arbitraire', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const [driver] = await db.query<{ invite_code: string }>(
        `insert into drivers (restaurant_id, display_name) values ($1, 'Tom') returning invite_code`,
        [IDS.restaurant],
      );
      expect(driver!.invite_code).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(
        await db.fails(
          `insert into drivers (restaurant_id, display_name, user_id) values ($1, 'X', $2)`,
          [IDS.restaurant, IDS.customer],
        ),
      ).toMatch(/permission denied/);
      expect(
        await db.fails(`update drivers set user_id = $1 where display_name = 'Tom'`, [
          IDS.customer,
        ]),
      ).toMatch(/permission denied/);
      expect(await db.fails(`update customers set user_id = $1`, [IDS.owner])).toMatch(
        /permission denied/,
      );
    }));
});

describe('RGPD · purge des positions', () => {
  it('supprime les positions de plus de 24 h', () =>
    withDb(async (db) => {
      await db.asSuper();
      await db.query(
        `update delivery_tracks set recorded_at = now() - interval '25 hours' where id in (select id from delivery_tracks limit 4)`,
      );
      await db.query(`update deliveries set last_position_at = now() - interval '25 hours'`);
      await db.as(service);
      const [{ purge_delivery_tracks: purged }] = (await db.query<{
        purge_delivery_tracks: number;
      }>(`select purge_delivery_tracks()`)) as [{ purge_delivery_tracks: number }];
      expect(purged).toBe(4);
      expect(await db.query(`select id from delivery_tracks`)).toHaveLength(2);
      expect(await db.query(`select last_lat from deliveries`)).toEqual([{ last_lat: null }]);
    }));

  it('n’est pas exécutable par les clients', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      expect(await db.fails(`select purge_delivery_tracks()`)).toMatch(/permission denied/);
      await db.as(anon);
      expect(await db.fails(`select purge_delivery_tracks()`)).toMatch(/permission denied/);
    }));
});
