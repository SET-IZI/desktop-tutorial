/**
 * Émulation minimale de Supabase Storage (dev et E2E sans Docker) :
 *   POST|PUT /storage/v1/object/<bucket>/<chemin>       envoi d'un fichier
 *   GET      /storage/v1/object/public/<bucket>/<chemin> lecture publique
 *   DELETE   /storage/v1/object/<bucket>  { prefixes }    suppression
 * Même règle d'accès que la policy Storage du bucket « menu » : l'utilisateur doit
 * être manager du restaurant dont l'identifiant est le premier dossier du chemin.
 * JAMAIS utilisé en production.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const BUCKETS = {
  menu: { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
};

export function createStorageLite({ databaseUrl, rootDir, verify }) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };
  const fail = (res, status, error, message) =>
    send(res, status, { statusCode: String(status), error, message });

  /** Chemin sûr sous rootDir (pas de « .. »). */
  function resolveFile(bucket, objectPath) {
    const file = path.resolve(rootDir, bucket, objectPath);
    if (!file.startsWith(path.resolve(rootDir, bucket) + path.sep)) return null;
    return file;
  }

  /** is_manager() évalué avec l'identité de l'utilisateur, comme la policy Storage. */
  async function canWrite(claims, objectPath) {
    const restaurantId = objectPath.split('/')[0];
    if (!/^[0-9a-f-]{36}$/i.test(restaurantId ?? '')) return false;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claims),
      ]);
      await client.query('set local role authenticated');
      const { rows } = await client.query('select public.is_manager($1::uuid) as ok', [
        restaurantId,
      ]);
      return rows[0]?.ok === true;
    } finally {
      await client.query('rollback');
      client.release();
    }
  }

  async function readBody(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw Object.assign(new Error('too_large'), { code: 'too_large' });
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const rest = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/?/, ''));

    try {
      if (req.method === 'GET' && rest.startsWith('public/')) {
        const [, bucket, ...parts] = rest.split('/');
        const file = BUCKETS[bucket] ? resolveFile(bucket, parts.join('/')) : null;
        if (!file) return fail(res, 404, 'not_found', 'Object not found');
        try {
          const [data, meta] = await Promise.all([
            readFile(file),
            readFile(`${file}.meta`, 'utf8'),
          ]);
          res.writeHead(200, {
            'content-type': JSON.parse(meta).contentType,
            'cache-control': 'public, max-age=3600',
          });
          res.end(data);
        } catch {
          fail(res, 404, 'not_found', 'Object not found');
        }
        return;
      }

      const claims = verify((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
      if (!claims || claims.role !== 'authenticated')
        return fail(res, 403, 'Unauthorized', 'invalid JWT');

      if (req.method === 'POST' || req.method === 'PUT') {
        const [bucket, ...parts] = rest.split('/');
        const config = BUCKETS[bucket];
        const objectPath = parts.join('/');
        const file = config ? resolveFile(bucket, objectPath) : null;
        if (!config || !file) return fail(res, 404, 'Bucket not found', 'Bucket not found');
        if (!(await canWrite(claims, objectPath))) {
          return fail(res, 403, 'Unauthorized', 'new row violates row-level security policy');
        }
        // storage-js envoie un Blob/File en multipart/form-data et un ArrayBuffer en brut.
        const rawType = String(req.headers['content-type'] ?? '');
        let body = await readBody(req, config.maxBytes + 64 * 1024);
        let contentType = rawType.split(';')[0].trim();
        if (contentType === 'multipart/form-data') {
          const form = await new Request('http://local', {
            method: 'POST',
            headers: { 'content-type': rawType },
            body,
          }).formData();
          const part = [...form.values()].find((v) => typeof v !== 'string');
          if (!part) return fail(res, 400, 'invalid_request', 'missing file');
          body = Buffer.from(await part.arrayBuffer());
          contentType = part.type;
        }
        if (body.length > config.maxBytes)
          return fail(
            res,
            413,
            'Payload too large',
            'The object exceeded the maximum allowed size',
          );
        if (!config.types.includes(contentType))
          return fail(res, 415, 'invalid_mime_type', `mime type ${contentType} is not supported`);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
        await writeFile(`${file}.meta`, JSON.stringify({ contentType }));
        return send(res, 200, { Id: randomUUID(), Key: `${bucket}/${objectPath}` });
      }

      if (req.method === 'DELETE') {
        const bucket = rest.split('/')[0];
        const { prefixes = [] } = JSON.parse((await readBody(req, 64 * 1024)).toString() || '{}');
        const removed = [];
        for (const objectPath of prefixes) {
          const file = resolveFile(bucket, objectPath);
          if (!file || !(await canWrite(claims, objectPath))) continue;
          await rm(file, { force: true });
          await rm(`${file}.meta`, { force: true });
          removed.push({ name: objectPath, bucket_id: bucket });
        }
        return send(res, 200, removed);
      }

      return fail(
        res,
        404,
        'not_implemented',
        `storage-lite : ${req.method} ${url.pathname} non émulé`,
      );
    } catch (error) {
      if (error.code === 'too_large')
        return fail(res, 413, 'Payload too large', 'The object exceeded the maximum allowed size');
      console.error('[storage-lite]', error);
      return fail(res, 500, 'internal', 'storage-lite error');
    }
  }

  return { handle, close: () => pool.end() };
}
