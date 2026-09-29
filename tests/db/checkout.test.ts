import { anon, IDS, service, user, withDb, type Db } from './helpers';

const SLOT = '2030-01-08T11:00:00Z';

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    restaurant_id: IDS.restaurant,
    location_id: IDS.location,
    fulfillment: 'pickup',
    scheduled_for: SLOT,
    status: 'new',
    payment_method: 'on_site',
    payment_status: 'unpaid',
    customer_name: 'Inès',
    customer_phone: '+33611111111',
    customer_email: 'ines@example.com',
    locale: 'fr',
    subtotal_cents: 2000,
    total_cents: 2000,
    items: [
      {
        product_id: 'b0000000-0000-4000-8000-000000000401',
        name: 'Tiramisu maison',
        unit_price_cents: 650,
        quantity: 2,
        options: [],
        total_cents: 1300,
      },
      {
        product_id: 'b0000000-0000-4000-8000-000000000502',
        name: 'Thé glacé pêche',
        unit_price_cents: 700,
        quantity: 1,
        options: [],
        total_cents: 700,
      },
    ],
    ...overrides,
  };
}

async function place(db: Db, overrides: Record<string, unknown> = {}) {
  const [row] = await db.query<{ order_id: string; order_number: number; order_token: string }>(
    `select * from place_order($1::jsonb)`,
    [JSON.stringify(orderPayload(overrides))],
  );
  return row!;
}

describe('place_order', () => {
  it('crée commande, lignes et fiche client en une fois', () =>
    withDb(async (db) => {
      await db.as(service);
      const order = await place(db);
      expect(order.order_number).toBe(4);
      expect(order.order_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      await db.asSuper();
      const [o] = await db.query<{ status: string; placed_at: Date | null; customer_id: string }>(
        `select status, placed_at, customer_id from orders where id = $1`,
        [order.order_id],
      );
      expect(o!.status).toBe('new');
      expect(o!.placed_at).toBeInstanceOf(Date);
      expect(
        await db.query(`select id from order_items where order_id = $1`, [order.order_id]),
      ).toHaveLength(2);
      const [c] = await db.query<{ orders_count: number; total_spent_cents: string }>(
        `select orders_count, total_spent_cents from customers where id = $1`,
        [o!.customer_id],
      );
      expect(c).toMatchObject({ orders_count: 1, total_spent_cents: '2000' });
    }));

  it('retrouve un client existant par email ou téléphone', () =>
    withDb(async (db) => {
      await db.as(service);
      await place(db, {
        customer_email: 'LEA@miaamm.test',
        customer_phone: null,
        customer_name: 'Léa',
      });
      await db.asSuper();
      const rows = await db.query<{ orders_count: number }>(
        `select orders_count from customers where lower(email) = 'lea@miaamm.test'`,
      );
      expect(rows).toEqual([{ orders_count: 4 }]); // 3 dans le seed + 1
    }));

  it('refuse un créneau complet (capacité 6) ou bloqué', () =>
    withDb(async (db) => {
      await db.as(service);
      for (let i = 0; i < 6; i++)
        await place(db, { customer_email: `c${i}@example.com`, customer_phone: null });
      expect(
        await db.fails(`select * from place_order($1::jsonb)`, [JSON.stringify(orderPayload())]),
      ).toMatch(/slot_full/);

      const other = '2030-01-08T11:15:00Z';
      await db.asSuper();
      await db.query(
        `insert into time_slots (restaurant_id, location_id, starts_at, is_blocked) values ($1, $2, $3, true)`,
        [IDS.restaurant, IDS.location, other],
      );
      await db.as(service);
      expect(
        await db.fails(`select * from place_order($1::jsonb)`, [
          JSON.stringify(orderPayload({ scheduled_for: other })),
        ]),
      ).toMatch(/slot_unavailable/);
    }));

  it('les paniers en attente de paiement de plus de 15 min libèrent leur place', () =>
    withDb(async (db) => {
      await db.as(service);
      const pending = [];
      for (let i = 0; i < 6; i++) {
        pending.push(
          await place(db, {
            status: 'pending_payment',
            payment_method: 'card',
            payment_status: 'pending',
            customer_email: `p${i}@example.com`,
            customer_phone: null,
          }),
        );
      }
      await db.asSuper();
      await db.query(
        `update orders set created_at = now() - interval '20 minutes' where id = any($1::uuid[])`,
        [pending.map((p) => p.order_id)],
      );
      await db.as(service);
      expect((await place(db)).order_id).toBeTruthy();
    }));

  it('refuse une commande vide ou un sous-total incohérent', () =>
    withDb(async (db) => {
      await db.as(service);
      expect(
        await db.fails(`select * from place_order($1::jsonb)`, [
          JSON.stringify(orderPayload({ items: [] })),
        ]),
      ).toMatch(/empty_order/);
      expect(
        await db.fails(`select * from place_order($1::jsonb)`, [
          JSON.stringify(orderPayload({ subtotal_cents: 1000, total_cents: 1000 })),
        ]),
      ).toMatch(/subtotal_mismatch/);
    }));

  it('n’est exécutable que par le serveur', () =>
    withDb(async (db) => {
      await db.as(anon);
      expect(await db.fails(`select * from place_order('{}'::jsonb)`)).toMatch(/permission denied/);
      await db.as(user(IDS.owner));
      expect(await db.fails(`select * from place_order('{}'::jsonb)`)).toMatch(/permission denied/);
    }));
});

describe('mark_order_paid', () => {
  it('confirme une seule fois et compte la commande pour le client', () =>
    withDb(async (db) => {
      await db.as(service);
      const order = await place(db, {
        status: 'pending_payment',
        payment_method: 'card',
        payment_status: 'pending',
      });
      await db.query(`update orders set stripe_payment_intent_id = 'pi_test_1' where id = $1`, [
        order.order_id,
      ]);

      const [first] = await db.query<{ mark_order_paid: string | null }>(
        `select mark_order_paid('pi_test_1', 2000)`,
      );
      expect(first!.mark_order_paid).toBe(order.order_id);
      const [again] = await db.query<{ mark_order_paid: string | null }>(
        `select mark_order_paid('pi_test_1', 2000)`,
      );
      expect(again!.mark_order_paid).toBeNull();

      await db.asSuper();
      const [o] = await db.query(`select status, payment_status from orders where id = $1`, [
        order.order_id,
      ]);
      expect(o).toEqual({ status: 'new', payment_status: 'paid' });
      const [c] = await db.query<{ orders_count: number }>(
        `select orders_count from customers where email = 'ines@example.com'`,
      );
      expect(c!.orders_count).toBe(1);
    }));

  it('refuse un montant différent du total', () =>
    withDb(async (db) => {
      await db.as(service);
      const order = await place(db, {
        status: 'pending_payment',
        payment_method: 'card',
        payment_status: 'pending',
      });
      await db.query(`update orders set stripe_payment_intent_id = 'pi_test_2' where id = $1`, [
        order.order_id,
      ]);
      expect(await db.fails(`select mark_order_paid('pi_test_2', 100)`)).toMatch(/amount_mismatch/);
    }));

  it('ignore un paiement inconnu', () =>
    withDb(async (db) => {
      await db.as(service);
      const [r] = await db.query<{ mark_order_paid: string | null }>(
        `select mark_order_paid('pi_inconnu', 100)`,
      );
      expect(r!.mark_order_paid).toBeNull();
    }));
});

describe('stripe_events', () => {
  it('est invisible hors serveur', () =>
    withDb(async (db) => {
      await db.as(anon);
      expect(await db.fails(`select * from stripe_events`)).toMatch(/permission denied/);
    }));
});
