import { createOtherRestaurant, IDS, user, withDb, type Db } from './helpers';

const NEWCOMER = '00000000-0000-4000-8000-0000000000e1';

async function addUser(db: Db, id: string, email: string) {
  await db.asSuper();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
}

async function invite(db: Db, email: string, role = 'manager') {
  await db.as(user(IDS.owner));
  const [row] = await db.query<{ token: string }>(
    `insert into team_invites (restaurant_id, email, role) values ($1, $2, $3) returning token`,
    [IDS.restaurant, email, role],
  );
  return row!.token;
}

describe('Équipe · membres', () => {
  it('owner et manager voient les emails ; cuisine et autres restaurants non', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      const members = await db.query<{ email: string; role: string }>(
        `select email, role from team_members($1)`,
        [IDS.restaurant],
      );
      expect(members).toEqual(
        expect.arrayContaining([
          { email: 'mimi@miaamm.test', role: 'owner' },
          { email: 'cuisine@miaamm.test', role: 'kitchen' },
        ]),
      );

      await db.as(user(IDS.kitchen));
      expect(await db.fails(`select * from team_members($1)`, [IDS.restaurant])).toMatch(
        /forbidden/,
      );
      const other = await createOtherRestaurant(db);
      await db.as(user(other.ownerId));
      expect(await db.fails(`select * from team_members($1)`, [IDS.restaurant])).toMatch(
        /forbidden/,
      );
    }));

  it('seul l’owner change les rôles ; le dernier owner ne peut pas partir', () =>
    withDb(async (db) => {
      await db.as(user(IDS.owner));
      await db.query(
        `update users_roles set role = 'manager' where user_id = $1 and restaurant_id = $2`,
        [IDS.kitchen, IDS.restaurant],
      );
      expect(
        await db.fails(
          `update users_roles set role = 'manager' where user_id = $1 and restaurant_id = $2`,
          [IDS.owner, IDS.restaurant],
        ),
      ).toMatch(/au moins un propriétaire/);

      // Hors owner, aucun changement de rôle (0 ligne visible en écriture).
      await db.as(user(IDS.kitchen));
      const updated = await db.query(
        `update users_roles set role = 'owner' where user_id = $1 and restaurant_id = $2 returning id`,
        [IDS.kitchen, IDS.restaurant],
      );
      expect(updated).toEqual([]);
    }));
});

describe('Équipe · invitations', () => {
  it('l’owner invite ; le compte au bon email rejoint avec le rôle prévu', () =>
    withDb(async (db) => {
      await addUser(db, NEWCOMER, 'Nouveau@Miaamm.test');
      const token = await invite(db, 'nouveau@miaamm.test', 'kitchen');
      expect(token).toMatch(/^[0-9a-f]{64}$/);

      await db.as(user(NEWCOMER));
      expect(
        await db.query(`select restaurant_name, role, expired, accepted from invite_details($1)`, [
          token,
        ]),
      ).toEqual([
        { restaurant_name: 'Chez Mimi', role: 'kitchen', expired: false, accepted: false },
      ]);
      const [{ accept_team_invite: restaurantId }] = (await db.query<{
        accept_team_invite: string;
      }>(`select accept_team_invite($1)`, [token])) as [{ accept_team_invite: string }];
      expect(restaurantId).toBe(IDS.restaurant);
      expect(await db.query(`select role from users_roles where user_id = $1`, [NEWCOMER])).toEqual(
        [{ role: 'kitchen' }],
      );
      // Lien à usage unique.
      expect(await db.fails(`select accept_team_invite($1)`, [token])).toMatch(/invite_used/);
    }));

  it('refuse un autre email, un lien expiré, un jeton inconnu', () =>
    withDb(async (db) => {
      await addUser(db, NEWCOMER, 'intrus@miaamm.test');
      const token = await invite(db, 'nouveau@miaamm.test');
      await db.as(user(NEWCOMER));
      expect(await db.fails(`select accept_team_invite($1)`, [token])).toMatch(/email_mismatch/);
      expect(await db.fails(`select accept_team_invite('nope')`)).toMatch(/invite_not_found/);

      await db.asSuper();
      await db.query(`update team_invites set expires_at = now() - interval '1 minute'`);
      await db.query(`update auth.users set email = 'nouveau@miaamm.test' where id = $1`, [
        NEWCOMER,
      ]);
      await db.as(user(NEWCOMER));
      expect(await db.fails(`select accept_team_invite($1)`, [token])).toMatch(/invite_expired/);
    }));

  it('invitations réservées à l’owner, rôle owner interdit, une seule en attente par email', () =>
    withDb(async (db) => {
      await invite(db, 'double@miaamm.test');
      expect(
        await db.fails(
          `insert into team_invites (restaurant_id, email, role) values ($1, 'DOUBLE@miaamm.test', 'kitchen')`,
          [IDS.restaurant],
        ),
      ).toMatch(/duplicate key/);
      expect(
        await db.fails(
          `insert into team_invites (restaurant_id, email, role) values ($1, 'x@miaamm.test', 'owner')`,
          [IDS.restaurant],
        ),
      ).toMatch(/check constraint/);

      await db.as(user(IDS.kitchen));
      expect(await db.query(`select token from team_invites`)).toEqual([]);
      expect(
        await db.fails(
          `insert into team_invites (restaurant_id, email, role) values ($1, 'y@miaamm.test', 'kitchen')`,
          [IDS.restaurant],
        ),
      ).toMatch(/row-level security/);
    }));
});
