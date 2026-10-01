import { createOtherRestaurant, IDS, user, withDb } from './helpers';

const sub = (endpoint: string) => [IDS.restaurant, endpoint, 'BPkey', 'authkey'];
const INSERT = `insert into push_subscriptions (restaurant_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`;

describe('Abonnements push', () => {
  it('un membre de l’équipe enregistre son appareil et ne voit que les siens', () =>
    withDb(async (db) => {
      await db.as(user(IDS.kitchen));
      await db.query(INSERT, sub('https://push.example/kitchen'));
      await db.as(user(IDS.owner));
      await db.query(INSERT, sub('https://push.example/owner'));
      expect(await db.query(`select endpoint from push_subscriptions`)).toEqual([
        { endpoint: 'https://push.example/owner' },
      ]);
      // Supprimer l'appareil d'un autre : aucune ligne touchée.
      await db.query(
        `delete from push_subscriptions where endpoint = 'https://push.example/kitchen'`,
      );
      await db.asSuper();
      expect(await db.query(`select count(*)::int as n from push_subscriptions`)).toEqual([
        { n: 2 },
      ]);
    }));

  it('refusé hors de l’équipe et pour un autre utilisateur', () =>
    withDb(async (db) => {
      const other = await createOtherRestaurant(db);
      await db.as(user(other.ownerId));
      expect(await db.fails(INSERT, sub('https://push.example/x'))).toMatch(/row-level security/);
      await db.as(user(IDS.customer));
      expect(await db.fails(INSERT, sub('https://push.example/y'))).toMatch(/row-level security/);
      await db.as(user(IDS.owner));
      expect(
        await db.fails(
          `insert into push_subscriptions (restaurant_id, user_id, endpoint, p256dh, auth) values ($1, $2, 'https://push.example/z', 'k', 'a')`,
          [IDS.restaurant, IDS.kitchen],
        ),
      ).toMatch(/permission denied/);
    }));
});
