#!/usr/bin/env bash
# Recrée une base Postgres « nue » avec le shim Supabase, les migrations et le seed.
# Usage : pnpm db:reset:plain   (DATABASE_URL par défaut ci-dessous)
# Avec la Supabase CLI + Docker, préférer : pnpm exec supabase db reset
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/miaamm_test}"
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
ADMIN_URL="${DATABASE_URL%/*}/postgres"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

echo "→ Base ${DB_NAME}"
"${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists \"${DB_NAME}\" with (force)"
"${PSQL[@]}" "$ADMIN_URL" -c "create database \"${DB_NAME}\""

echo "→ Shim Supabase"
"${PSQL[@]}" "$DATABASE_URL" -f "$ROOT/scripts/db/supabase-shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" "$DATABASE_URL" -f "$f"
done

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  echo "→ seed.sql"
  "${PSQL[@]}" "$DATABASE_URL" -f "$ROOT/supabase/seed.sql"
fi
echo "✓ Base prête"
