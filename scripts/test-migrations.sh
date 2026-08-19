#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "TEST MIGRATIONS: BASELINE -> UP -> ROLLBACK -> COMPARE"
echo "========================================="

echo "1. Moving migrations temporarily..."
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

echo "2. Starting clean instance..."
npx supabase stop || true
npx supabase start

STATUS=$(npx supabase status -o env)
DB_URL=$(echo "$STATUS" | grep "DB_URL=" | cut -d'=' -f2)

if [[ -z "$DB_URL" || "$DB_URL" == *"supabase.co"* ]]; then
  echo "Error: Must run against a local instance."
  exit 1
fi

echo "3. Applying BASELINE..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/baseline.sql

echo "4. Generating INITIAL DUMP..."
pg_dump "$DB_URL" -s -n public > initial_schema.sql
grep -v '^--' initial_schema.sql | grep -v '^[[:space:]]*$' > initial_schema_normalized.sql

echo "5. Restoring migrations directory..."
trap_restore
trap - EXIT

echo "6. Applying migrations UP..."
npx supabase migration up

echo "7. Applying rollbacks REVERSE ORDER..."
ROLLBACKS=$(ls supabase/rollbacks/*.rollback.sql | sort -r)

for rollback in $ROLLBACKS; do
  echo "Rolling back $rollback ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$rollback"
done

echo "8. Generating FINAL DUMP..."
pg_dump "$DB_URL" -s -n public > final_schema.sql
grep -v '^--' final_schema.sql | grep -v '^[[:space:]]*$' > final_schema_normalized.sql

echo "9. Comparing DUMPS..."
if diff -u initial_schema_normalized.sql final_schema_normalized.sql > schema_diff.txt; then
  echo "SUCCESS: Rollback perfectly restored the baseline."
  rm initial_schema.sql initial_schema_normalized.sql final_schema.sql final_schema_normalized.sql schema_diff.txt
  exit 0
else
  echo "ERROR: Schema differs after rollbacks!"
  cat schema_diff.txt
  exit 1
fi
