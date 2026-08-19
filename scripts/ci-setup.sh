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
# Extract configuration via supabase status
STATUS=$(npx supabase status -o env)

export NEXT_PUBLIC_SUPABASE_URL=$(echo "$STATUS" | grep "API_URL=" | cut -d'=' -f2)
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$STATUS" | grep "ANON_KEY=" | cut -d'=' -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(echo "$STATUS" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2)
DB_URL=$(echo "$STATUS" | grep "DB_URL=" | cut -d'=' -f2)

if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" || "$NEXT_PUBLIC_SUPABASE_URL" == *"supabase.co"* ]]; then
  echo "Error: Invalid NEXT_PUBLIC_SUPABASE_URL."
  exit 1
fi
if [[ -z "$DB_URL" || "$DB_URL" == *"supabase.co"* ]]; then
  echo "Error: Invalid DB_URL."
  exit 1
fi

echo "5. Loading baseline..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/baseline.sql

echo "6. Restoring migrations directory explicitly..."
trap_restore
trap - EXIT

echo "7. Applying migrations in chronological order..."
npx supabase migration up

echo "8. Exporting variables to GitHub Actions..."
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" >> $GITHUB_ENV
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" >> $GITHUB_ENV
  echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> $GITHUB_ENV
fi

echo "9. Running seed..."
npx tsx tests/setup/seed-supabase.ts

echo "CI Setup completed."
