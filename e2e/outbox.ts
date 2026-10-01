import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Boîte d'envoi des modes simulés (MIAAMM_EMAIL_MODE / MIAAMM_PUSH_MODE = mock). */
const DIR = path.resolve(process.env.MIAAMM_OUTBOX_DIR ?? '.tools/outbox');

export interface OutboxMessage {
  kind: 'email' | 'push';
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  title?: string;
  body?: string;
  url?: string;
  restaurantId?: string;
}

export async function readOutbox(): Promise<OutboxMessage[]> {
  let files: string[] = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(DIR, f), 'utf8')) as OutboxMessage),
  );
}

export const emailsTo = async (to: string) =>
  (await readOutbox()).filter((m) => m.kind === 'email' && m.to === to);
