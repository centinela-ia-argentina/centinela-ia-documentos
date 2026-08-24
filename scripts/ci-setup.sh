#!/usr/bin/env bash
set -euo pipefail

echo "1. Checking local instance..."
if [[ "${SUPABASE_URL:-}" == *"supabase.co"* ]]; then
  echo "Error: Remote instance detected. Aborting."
  exit 1
fi

echo "2. Moving migrations temporarily..."
mkdir -p supabase/migrations_temp
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations)" ]; then
  mv supabase/migrations/* supabase/migrations_temp/
fi

trap_restore() {
  echo "Restoring migrations directory..."
  mkdir -p supabase/migrations
  if [ -d "supabase/migrations_temp" ] && [ "$(ls -A supabase/migrations_temp)" ]; then
    mv supabase/migrations_temp/* supabase/migrations/
  fi
  rm -rf supabase/migrations_temp
}
trap trap_restore EXIT

echo "3. Starting Supabase without migrations..."
npx supabase start

echo "4. Obtaining local credentials..."
SUPABASE_ENV_FILE="$(mktemp)"
npx supabase status -o env > "$SUPABASE_ENV_FILE"

set -a
source "$SUPABASE_ENV_FILE"
set +a

rm -f "$SUPABASE_ENV_FILE"

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

: "${API_URL:?Missing API_URL}"
: "${DB_URL:?Missing DB_URL}"
: "${ANON_KEY:?Missing ANON_KEY}"
: "${SERVICE_ROLE_KEY:?Missing SERVICE_ROLE_KEY}"

for value in "$API_URL" "$DB_URL"; do
  if [[ "$value" == *"supabase.co"* ]]; then
    echo "ERROR: Remote Supabase endpoint detected in $value"
    exit 1
  fi
  if [[ "$value" != *"127.0.0.1"* && "$value" != *"localhost"* ]]; then
    echo "ERROR: Connection URL does not point to loopback/local: $value"
    exit 1
  fi
done

echo "5. Loading baseline..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/baseline.sql

echo "6. Restoring migrations directory explicitly..."
trap_restore
trap - EXIT

echo "7. Applying migrations in chronological order..."
npx supabase migration up

echo "8. Exporting variables to GitHub Actions..."
if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
  } >> "$GITHUB_ENV"
fi

echo "9. Validating document_chunks schema before seed..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_chunks'
ORDER BY ordinal_position;
"

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document_chunks'
      AND column_name = 'organization_id'
  ) THEN
    RAISE EXCEPTION 'document_chunks.organization_id is missing!';
  END IF;
END \$\$;
"

echo "10. Reloading PostgREST schema cache..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema';"
sleep 2 # deterministic minimal wait for schema reload

echo "11. Running seed..."
npx tsx tests/setup/seed-supabase.ts

echo "CI Setup completed."
