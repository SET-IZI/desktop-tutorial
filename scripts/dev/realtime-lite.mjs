/**
 * Émulation minimale de Supabase Realtime (dev et E2E sans Docker), limitée à ce
 * que l'app utilise : `postgres_changes` sur les tables de la publication
 * `supabase_realtime`, avec la même règle que Supabase : un événement n'est
 * envoyé que si la ligne est visible par l'abonné (RLS évaluée avec son JWT).
 *
 *   ws://127.0.0.1:54321/realtime/v1/websocket?apikey=…&vsn=2.0.0
 *
 * Protocole Phoenix, sérialisation v2 : [join_ref, ref, topic, event, payload]
 * (relu dans @supabase/realtime-js). Les changements arrivent par LISTEN/NOTIFY
 * via un trigger posé au démarrage. JAMAIS utilisé en production.
 */
import pg from 'pg';
import { WebSocketServer } from 'ws';

const CHANNEL = 'realtime_lite';

const SETUP_SQL = `
create schema if not exists realtime_lite;
create or replace function realtime_lite.notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_notify('${CHANNEL}', json_build_object(
    'schema', tg_table_schema,
    'table', tg_table_name,
    'type', tg_op,
    'id', case when tg_op = 'DELETE' then old.id else new.id end,
    'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
  )::text);
  return null;
end $$;
`;

export function createRealtimeLite({ databaseUrl, verify }) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Set<{ ws: import('ws').WebSocket, claims: object, channels: Map<string, any> }>} */
  const clients = new Set();
  let nextId = 1;

  async function setup() {
    await pool.query(SETUP_SQL);
    const { rows } = await pool.query(
      `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
    );
    for (const { schemaname, tablename } of rows) {
      const name = `realtime_lite_${tablename}`;
      await pool.query(`drop trigger if exists ${name} on ${schemaname}.${tablename}`);
      await pool.query(
        `create trigger ${name} after insert or update or delete on ${schemaname}.${tablename}
         for each row execute function realtime_lite.notify()`,
      );
    }
    const listener = new pg.Client({ connectionString: databaseUrl });
    await listener.connect();
    await listener.query(`listen ${CHANNEL}`);
    listener.on('notification', (msg) => {
      try {
        void dispatch(JSON.parse(msg.payload ?? '{}'));
      } catch (error) {
        console.error('[realtime-lite]', error);
      }
    });
    return listener;
  }
  const ready = setup().catch((error) => {
    console.error('[realtime-lite] initialisation impossible', error);
  });

  /** « col=eq.valeur » (seul opérateur utilisé par l'app). */
  function matchesFilter(filter, record) {
    if (!filter) return true;
    const m = /^([a-z_]+)=eq\.(.+)$/.exec(filter);
    if (!m || !record) return false;
    return String(record[m[1]]) === m[2];
  }

  /** La ligne est-elle visible pour cet abonné (RLS, comme Realtime) ? */
  async function canSee(claims, change) {
    const role = claims.role === 'authenticated' ? 'authenticated' : 'anon';
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claims),
      ]);
      await client.query(`set local role ${role}`);
      const { rows } = await client.query(
        `select 1 from ${client.escapeIdentifier(change.schema)}.${client.escapeIdentifier(change.table)} where id = $1`,
        [change.id],
      );
      return rows.length > 0;
    } catch {
      return false;
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
  }

  async function dispatch(change) {
    for (const client of clients) {
      for (const [topic, channel] of client.channels) {
        const ids = channel.bindings
          .filter(
            (b) =>
              (b.schema === '*' || b.schema === change.schema) &&
              (!b.table || b.table === '*' || b.table === change.table) &&
              (b.event === '*' || b.event === change.type) &&
              matchesFilter(b.filter, change.record ?? change.old_record),
          )
          .map((b) => b.id);
        if (ids.length === 0) continue;
        // DELETE : la ligne n'existe plus, Supabase n'envoie alors que la clé primaire.
        if (change.type !== 'DELETE' && !(await canSee(client.claims, change))) continue;
        send(client.ws, [
          null,
          null,
          topic,
          'postgres_changes',
          {
            ids,
            data: {
              schema: change.schema,
              table: change.table,
              commit_timestamp: new Date().toISOString(),
              type: change.type,
              columns: [],
              record: change.record ?? {},
              old_record: change.type === 'INSERT' ? undefined : { id: change.id },
              errors: null,
            },
          },
        ]);
      }
    }
  }

  function send(ws, message) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  function claimsFrom(token) {
    const claims = token ? verify(token) : null;
    return claims ?? { role: 'anon' };
  }

  const debug = process.env.REALTIME_LITE_DEBUG
    ? (...a) => console.log('[realtime-lite]', ...a)
    : () => {};

  function onMessage(client, raw) {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    const [joinRef, ref, topic, event, payload] = message;
    if (topic !== 'phoenix') debug(event, topic, JSON.stringify(payload).slice(0, 300));
    const reply = (status, response = {}) =>
      send(client.ws, [joinRef, ref, topic, 'phx_reply', { status, response }]);

    if (topic === 'phoenix' && event === 'heartbeat') return reply('ok');

    if (event === 'phx_join') {
      if (payload?.access_token) client.claims = claimsFrom(payload.access_token);
      const changes = payload?.config?.postgres_changes ?? [];
      const bindings = changes.map((c) => ({
        id: nextId++,
        event: c.event ?? '*',
        schema: c.schema ?? 'public',
        table: c.table,
        filter: c.filter,
      }));
      client.channels.set(topic, { joinRef, bindings });
      return reply('ok', {
        postgres_changes: bindings.map((b, i) => ({ ...changes[i], id: b.id })),
      });
    }
    if (event === 'access_token') {
      if (payload?.access_token) client.claims = claimsFrom(payload.access_token);
      return;
    }
    if (event === 'phx_leave') {
      client.channels.delete(topic);
      return reply('ok');
    }
    // broadcast / presence : non émulés (inutilisés par l'app pour l'instant).
    return reply('ok');
  }

  function handleUpgrade(req, socket, head) {
    const url = new URL(req.url ?? '/', 'http://local');
    const apikey = url.searchParams.get('apikey');
    if (!apikey || !verify(apikey)) {
      socket.destroy();
      return;
    }
    void ready.then(() =>
      wss.handleUpgrade(req, socket, head, (ws) => {
        // Avant le join, l'identité est celle de la clé (anon) ; le JWT utilisateur arrive au join.
        const client = { ws, claims: claimsFrom(apikey), channels: new Map() };
        clients.add(client);
        ws.on('message', (raw) => onMessage(client, raw));
        ws.on('close', () => clients.delete(client));
      }),
    );
  }

  return {
    handleUpgrade,
    close: async () => {
      wss.close();
      await pool.end();
    },
  };
}
