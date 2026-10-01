import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getOutboxDir } from '@/lib/env';

/** Modes simulés : chaque message est écrit en JSON (lu par les tests E2E). */
export async function writeOutbox(kind: 'email' | 'push', message: Record<string, unknown>) {
  const dir = path.resolve(getOutboxDir());
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${Date.now()}-${kind}-${randomUUID()}.json`),
    JSON.stringify({ kind, at: new Date().toISOString(), ...message }, null, 2),
  );
}
