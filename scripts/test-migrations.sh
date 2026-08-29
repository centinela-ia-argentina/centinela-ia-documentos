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

echo "3. Obtaining local credentials securely..."
SUPABASE_ENV_FILE="$(mktemp)"
npx supabase status -o env > "$SUPABASE_ENV_FILE"

set -a
source "$SUPABASE_ENV_FILE"
set +a
rm -f "$SUPABASE_ENV_FILE"

: "${API_URL:?Missing API_URL}"
: "${DB_URL:?Missing DB_URL}"

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

echo "3.5 Resolving local database container for pg_dump..."
DB_CONTAINER="$(docker ps --filter 'name=supabase_db_' --filter 'status=running' --format '{{.ID}}' | head -n 1)"

if [[ -z "$DB_CONTAINER" ]]; then
  echo "ERROR: Local Supabase database container not found. Cannot run pg_dump 17."
  exit 1
fi

echo "PostgreSQL Server Version:"
psql "$DB_URL" -t -c "SELECT version();" | xargs
echo "pg_dump Version (inside container):"
docker exec -i "$DB_CONTAINER" pg_dump --version

echo "4. Applying BASELINE..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/baseline.sql

echo "5. Generating INITIAL SNAPSHOTS..."
docker exec -i "$DB_CONTAINER" pg_dump -U postgres -d postgres -s -n public --no-acl > initial_schema.sql
grep -v '^--' initial_schema.sql | grep -Ev '^\\(un)?restrict[[:space:]]' | grep -v '^[[:space:]]*$' > initial_schema_normalized.sql

psql "$DB_URL" -c "SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;" > initial_storage.txt
psql "$DB_URL" -A -t -c "
SELECT json_build_object(
  'schemaname', schemaname,
  'tablename', tablename,
  'policyname', policyname,
  'roles', roles,
  'cmd', cmd,
  'qual', qual,
  'with_check', with_check
)
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname, cmd;
" > initial_policies.json
psql "$DB_URL" -c "
SELECT
  object_type,
  schema_name,
  object_name,
  object_identity,
  grantee,
  privilege_type
FROM (
  SELECT
    'TABLE'::text AS object_type,
    table_schema::text AS schema_name,
    table_name::text AS object_name,
    ''::text AS object_identity,
    grantee::text AS grantee,
    privilege_type::text AS privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema IN ('public', 'storage')
  UNION ALL
  SELECT
    'ROUTINE'::text AS object_type,
    r.routine_schema::text AS schema_name,
    r.routine_name::text AS object_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS object_identity,
    r.grantee::text AS grantee,
    r.privilege_type::text AS privilege_type
  FROM information_schema.routine_privileges r
  JOIN pg_catalog.pg_proc p ON r.specific_name = p.proname || '_' || p.oid
  WHERE r.routine_schema = 'public'
) grants_snapshot
ORDER BY
  object_type,
  schema_name,
  object_name,
  object_identity,
  grantee,
  privilege_type;
" > initial_grants.txt
psql "$DB_URL" -c "SELECT p.proname, pg_get_function_identity_arguments(p.oid) FROM pg_catalog.pg_proc AS p JOIN pg_catalog.pg_namespace AS n ON p.pronamespace = n.oid WHERE n.nspname = 'public' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);" > initial_functions.txt

echo "6. Restoring migrations directory..."
trap_restore
trap - EXIT

echo "7. Verifying Rollbacks exist for Migrations..."
MIGRATION_COUNT=0
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations)" ]; then
  for migration in supabase/migrations/*.sql; do
    basename=$(basename "$migration" .sql)
    if [ ! -f "supabase/rollbacks/${basename}.rollback.sql" ]; then
      echo "ERROR: Missing rollback for migration ${basename}. Reversibility must be guaranteed."
      exit 1
    fi
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  done
fi

echo "8. Applying migrations UP (Local)..."
npx supabase migration up --local

echo "8.b Verifying migrations applied..."
APPLIED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM supabase_migrations.schema_migrations;" | tr -d ' ')
if [ "$APPLIED_COUNT" -lt "$MIGRATION_COUNT" ]; then
  echo "ERROR: Expected $MIGRATION_COUNT migrations applied, but found $APPLIED_COUNT"
  exit 1
fi
echo "SUCCESS: All $MIGRATION_COUNT migrations applied."

echo "8.c Verifying FORWARD INVARIANTS..."
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/verify_invariants.sql; then
  echo "ERROR: SQL invariants violated in FORWARD state!"
  exit 1
fi
echo "SUCCESS: Forward SQL invariants verified."

echo "9. Applying rollbacks REVERSE ORDER..."
if [ -d "supabase/rollbacks" ] && [ "$(ls -A supabase/rollbacks)" ]; then
  ROLLBACKS=$(ls supabase/rollbacks/*.rollback.sql | sort -r)
  for rollback in $ROLLBACKS; do
    echo "Rolling back $rollback ..."
    PGOPTIONS="-c centinela.is_ci=true" psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$rollback"
  done
fi

echo "10. Generating FINAL SNAPSHOTS..."
docker exec -i "$DB_CONTAINER" pg_dump -U postgres -d postgres -s -n public --no-acl > final_schema.sql
grep -v '^--' final_schema.sql | grep -Ev '^\\(un)?restrict[[:space:]]' | grep -v '^[[:space:]]*$' > final_schema_normalized.sql

psql "$DB_URL" -c "SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;" > final_storage.txt
psql "$DB_URL" -A -t -c "
SELECT json_build_object(
  'schemaname', schemaname,
  'tablename', tablename,
  'policyname', policyname,
  'roles', roles,
  'cmd', cmd,
  'qual', qual,
  'with_check', with_check
)
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname, cmd;
" > final_policies.json
psql "$DB_URL" -c "
SELECT
  object_type,
  schema_name,
  object_name,
  object_identity,
  grantee,
  privilege_type
FROM (
  SELECT
    'TABLE'::text AS object_type,
    table_schema::text AS schema_name,
    table_name::text AS object_name,
    ''::text AS object_identity,
    grantee::text AS grantee,
    privilege_type::text AS privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema IN ('public', 'storage')
  UNION ALL
  SELECT
    'ROUTINE'::text AS object_type,
    r.routine_schema::text AS schema_name,
    r.routine_name::text AS object_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS object_identity,
    r.grantee::text AS grantee,
    r.privilege_type::text AS privilege_type
  FROM information_schema.routine_privileges r
  JOIN pg_catalog.pg_proc p ON r.specific_name = p.proname || '_' || p.oid
  WHERE r.routine_schema = 'public'
) grants_snapshot
ORDER BY
  object_type,
  schema_name,
  object_name,
  object_identity,
  grantee,
  privilege_type;
" > final_grants.txt
psql "$DB_URL" -c "SELECT p.proname, pg_get_function_identity_arguments(p.oid) FROM pg_catalog.pg_proc AS p JOIN pg_catalog.pg_namespace AS n ON p.pronamespace = n.oid WHERE n.nspname = 'public' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);" > final_functions.txt

echo "11. Comparing DUMPS..."
ERRORS=0

# Create standard diffs first so they are available as artifacts and for the Node script
diff -u initial_schema_normalized.sql final_schema_normalized.sql > schema_diff.txt || true
diff -u initial_storage.txt final_storage.txt > storage_diff.txt || true
diff -u initial_policies.json final_policies.json > policies_diff.txt || true
diff -u initial_grants.txt final_grants.txt > grants_diff.txt || true
diff -u initial_functions.txt final_functions.txt > functions_diff.txt || true

echo "Checking EXACT authorized security overrides against strict contract..."
if ! node supabase/ci/verify-safe-rollback.js; then
  echo "ERROR: Diffs failed strict contract verification!"
  ERRORS=1
fi

echo "12. Running strict SQL invariants..."
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci/verify_invariants.sql; then
  echo "ERROR: SQL invariants violated post-rollback!"
  ERRORS=1
fi

if [ -s functions_diff.txt ]; then
  echo "ERROR: Functions differ after rollbacks!"
  cat functions_diff.txt
  ERRORS=1
fi

if [ "$ERRORS" -eq 1 ]; then
  echo "FAILURE: Instance state was not completely restored."
  exit 1
else
  echo "SUCCESS: Rollbacks perfectly restored the baseline."
  exit 0
fi
