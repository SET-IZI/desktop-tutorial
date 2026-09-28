/**
 * Exporte les données d'une boutique (JSON) pour l'aperçu statique.
 * Usage : tsx --env-file=.env.local scripts/preview/dump-data.ts chez-mimi
 */
import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';
import { fetchStorefront } from '@/lib/storefront/fetch';
import type { Database } from '@/types/database';

async function main() {
  const slug = process.argv[2] ?? 'chez-mimi';
  const env = getPublicEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );
  const storefront = await fetchStorefront(supabase, slug);
  if (!storefront) {
    console.error(`Boutique introuvable : ${slug}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(storefront));
}

void main();
