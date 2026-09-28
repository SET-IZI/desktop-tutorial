#!/usr/bin/env node
/**
 * « Supabase lite » : PostgREST + un mini proxy qui expose /rest/v1 comme Supabase.
 * Permet de faire tourner la boutique et les tests E2E sans Docker, sur le Postgres
 * local préparé par `pnpm db:reset`.
 *
 *   pnpm supabase:lite            → http://127.0.0.1:54321/rest/v1
 *
 * Avec Docker, préférer `pnpm exec supabase start` (mêmes URL et clés de dev).
 * Auth, Realtime et Storage ne sont pas émulés ici.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERSION = '12.2.12';
const TOOLS = path.join(ROOT, '.tools');
const BIN = path.join(TOOLS, `postgrest-v${VERSION}`);
const URL_TGZ = `https://github.com/PostgREST/postgrest/releases/download/v${VERSION}/postgrest-v${VERSION}-linux-static-x86-64.tar.xz`;

const PORT = Number(process.env.SUPABASE_LITE_PORT ?? 54321);
const PGRST_PORT = PORT + 9;
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/miaamm_test';
// Secret JWT de développement de la Supabase CLI (public, jamais utilisé en production).
const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';

function ensureBinary() {
  if (existsSync(BIN)) return;
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      'supabase-lite ne fournit PostgREST que pour linux-x64. Utiliser `supabase start`.',
    );
  }
  mkdirSync(TOOLS, { recursive: true });
  console.log(`→ Téléchargement de PostgREST v${VERSION}`);
  const archive = path.join(TOOLS, 'postgrest.tar.xz');
  execFileSync('curl', ['-sSfL', '-o', archive, URL_TGZ], { stdio: 'inherit' });
  execFileSync('tar', ['-xJf', archive, '-C', TOOLS]);
  execFileSync('mv', [path.join(TOOLS, 'postgrest'), BIN]);
}

ensureBinary();

// PostgREST se connecte en "authenticator" puis prend le rôle du JWT.
const dbUri = new URL(DATABASE_URL);
dbUri.username = 'authenticator';
dbUri.password = 'postgres';

const postgrest = spawn(BIN, [], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    PGRST_DB_URI: dbUri.toString(),
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_SERVER_PORT: String(PGRST_PORT),
    PGRST_LOG_LEVEL: 'warn',
  },
});

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (!url.startsWith('/rest/v1')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: `supabase-lite : ${url} non émulé` }));
    return;
  }
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: PGRST_PORT,
      method: req.method,
      path: url.slice('/rest/v1'.length) || '/',
      headers: { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: `PostgREST indisponible : ${error.message}` }));
  });
  req.pipe(upstream);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ supabase-lite sur http://127.0.0.1:${PORT}/rest/v1 (PostgREST :${PGRST_PORT})`);
});

function shutdown() {
  server.close();
  postgrest.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
postgrest.on('exit', (code) => {
  console.error(`PostgREST s'est arrêté (code ${code})`);
  server.close();
  process.exit(code ?? 1);
});
