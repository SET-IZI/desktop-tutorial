import pg from 'pg';

/** Accès direct à la base de démo pour préparer un cas (ex. créneau bloqué). */
export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/miaamm_test',
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
