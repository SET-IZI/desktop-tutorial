import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/** Client navigateur : réservé à Auth et Realtime (cf. CLAUDE.md). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
