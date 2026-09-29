/**
 * Émulation minimale de l'API Supabase Auth (GoTrue) pour le développement et les E2E
 * sans Docker. Couvre ce qu'utilise Miaamm via `@supabase/supabase-js` :
 *   POST /auth/v1/token?grant_type=password
 *   POST /auth/v1/token?grant_type=refresh_token
 *   POST /auth/v1/signup            (email + mot de passe, ou anonyme)
 *   GET  /auth/v1/user
 *   POST /auth/v1/logout
 * Comptes stockés dans auth.users (mots de passe bcrypt via pgcrypto), JWT HS256 signés
 * avec le secret de dev de la Supabase CLI (le même que PostgREST vérifie).
 * JAMAIS utilisé en production : Supabase Auth prend le relais.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import pg from 'pg';

const API_VERSION = '2024-01-01';
const EXPIRES_IN = 3600;

export function createAuthLite({ databaseUrl, jwtSecret, issuer }) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  /** refresh_token → { userId, sessionId } (mémoire : perdu au redémarrage, c'est voulu). */
  const refreshTokens = new Map();

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  function sign(payload) {
    const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
    return `${head}.${createHmac('sha256', jwtSecret).update(head).digest('base64url')}`;
  }

  function verify(token) {
    const [h, p, s] = String(token).split('.');
    if (!h || !p || !s) return null;
    const expected = createHmac('sha256', jwtSecret).update(`${h}.${p}`).digest();
    const given = Buffer.from(s, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  }

  function toUser(row) {
    return {
      id: row.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: row.email ?? '',
      phone: '',
      email_confirmed_at: row.email_confirmed_at,
      confirmed_at: row.email_confirmed_at,
      last_sign_in_at: new Date().toISOString(),
      app_metadata: row.raw_app_meta_data ?? { provider: 'email', providers: ['email'] },
      user_metadata: row.raw_user_meta_data ?? {},
      identities: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_anonymous: row.is_anonymous,
    };
  }

  function session(row, sessionId = randomUUID()) {
    const now = Math.floor(Date.now() / 1000);
    const user = toUser(row);
    const refresh = randomBytes(24).toString('base64url');
    refreshTokens.set(refresh, { userId: row.id, sessionId });
    const access = sign({
      aud: 'authenticated',
      exp: now + EXPIRES_IN,
      iat: now,
      iss: issuer,
      sub: row.id,
      email: user.email,
      phone: '',
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: row.is_anonymous ? 'anonymous' : 'password', timestamp: now }],
      session_id: sessionId,
      is_anonymous: row.is_anonymous,
    });
    return {
      access_token: access,
      token_type: 'bearer',
      expires_in: EXPIRES_IN,
      expires_at: now + EXPIRES_IN,
      refresh_token: refresh,
      user,
    };
  }

  const USER_COLUMNS =
    'id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous';

  async function findUser(id) {
    const { rows } = await pool.query(`select ${USER_COLUMNS} from auth.users where id = $1`, [id]);
    return rows[0] ?? null;
  }

  function send(res, status, body) {
    res.writeHead(status, {
      'content-type': 'application/json',
      'x-supabase-api-version': API_VERSION,
    });
    res.end(body === undefined ? '' : JSON.stringify(body));
  }
  const fail = (res, status, code, msg) => send(res, status, { code, error_code: code, msg });

  async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    return raw ? JSON.parse(raw) : {};
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname.replace(/^\/auth\/v1/, '');

    try {
      if (req.method === 'POST' && path === '/token') {
        const grant = url.searchParams.get('grant_type');
        const body = await readJson(req);
        if (grant === 'password') {
          const { rows } = await pool.query(
            `select ${USER_COLUMNS} from auth.users
              where lower(email) = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)`,
            [body.email ?? '', body.password ?? ''],
          );
          if (!rows[0]) return fail(res, 400, 'invalid_credentials', 'Invalid login credentials');
          return send(res, 200, session(rows[0]));
        }
        if (grant === 'refresh_token') {
          const entry = refreshTokens.get(body.refresh_token);
          if (!entry)
            return fail(
              res,
              400,
              'refresh_token_not_found',
              'Invalid Refresh Token: Refresh Token Not Found',
            );
          refreshTokens.delete(body.refresh_token);
          const row = await findUser(entry.userId);
          if (!row) return fail(res, 400, 'user_not_found', 'User not found');
          return send(res, 200, session(row, entry.sessionId));
        }
        return fail(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
      }

      if (req.method === 'POST' && path === '/signup') {
        const body = await readJson(req);
        const anonymous = !body.email && !body.password;
        if (!anonymous) {
          if (!body.email || !body.password)
            return fail(res, 400, 'validation_failed', 'Email and password required');
          if (String(body.password).length < 6) {
            return send(res, 422, {
              code: 'weak_password',
              error_code: 'weak_password',
              msg: 'Password should be at least 6 characters.',
              weak_password: { reasons: ['length'] },
            });
          }
          const exists = await pool.query(
            `select 1 from auth.users where lower(email) = lower($1)`,
            [body.email],
          );
          if (exists.rowCount)
            return fail(res, 422, 'user_already_exists', 'User already registered');
        }
        const id = randomUUID();
        await pool.query(
          `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new,
             email_change, is_anonymous, created_at, updated_at)
           values ('00000000-0000-0000-0000-000000000000', $1::uuid, 'authenticated', 'authenticated', $2::text,
             case when $3::text is null then null else extensions.crypt($3::text, extensions.gen_salt('bf')) end,
             case when $2::text is null then null else now() end,
             $4::jsonb, $5::jsonb, '', '', '', '', $6::boolean, now(), now())`,
          [
            id,
            anonymous ? null : String(body.email).toLowerCase(),
            anonymous ? null : body.password,
            JSON.stringify(
              anonymous
                ? { provider: 'anonymous', providers: ['anonymous'] }
                : { provider: 'email', providers: ['email'] },
            ),
            JSON.stringify(body.data ?? {}),
            anonymous,
          ],
        );
        return send(res, 200, session(await findUser(id)));
      }

      const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

      if (req.method === 'GET' && path === '/user') {
        const claims = verify(bearer);
        if (!claims || claims.role !== 'authenticated')
          return fail(res, 401, 'bad_jwt', 'invalid JWT');
        const row = await findUser(claims.sub);
        if (!row) return fail(res, 404, 'user_not_found', 'User not found');
        return send(res, 200, toUser(row));
      }

      if (req.method === 'POST' && path === '/logout') {
        const claims = verify(bearer);
        if (claims) {
          for (const [token, entry] of refreshTokens)
            if (entry.userId === claims.sub) refreshTokens.delete(token);
        }
        return send(res, 204);
      }

      return fail(res, 404, 'not_implemented', `auth-lite : ${req.method} ${path} non émulé`);
    } catch (error) {
      console.error('[auth-lite]', error);
      return fail(res, 500, 'unexpected_failure', 'auth-lite error');
    }
  }

  return { handle, close: () => pool.end() };
}
