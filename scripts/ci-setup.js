const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const TEMP_MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations_temp');
const BASELINE_SQL = path.join(__dirname, '../supabase/ci/baseline.sql');
const SEED_SQL = path.join(__dirname, '../supabase/seed.sql');

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  try {
    console.log('1. Temporarily moving migrations...');
    if (fs.existsSync(MIGRATIONS_DIR)) {
      fs.renameSync(MIGRATIONS_DIR, TEMP_MIGRATIONS_DIR);
    } else {
      fs.mkdirSync(TEMP_MIGRATIONS_DIR);
    }

    console.log('2. Starting Supabase without migrations...');
    run('npx supabase start');

    console.log('3. Loading Baseline SQL with ON_ERROR_STOP...');
    // We use the supabase db execute command or direct psql
    // supabase db pull or push doesn't allow arbitrary file execution easily in all versions.
    // However, npx supabase db psql or piping to it works, but npx supabase start handles local db URL.
    // The easiest is mapping to the docker container or using psql.
    // Actually, npx supabase migration new/up or just npx supabase db reset handles the supabase/migrations folder, 
    // but we can execute arbitrary SQL with psql.
    run(`set PGPASSWORD=postgres&& psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${BASELINE_SQL}"`);

    console.log('4. Restoring migrations directory...');
    fs.renameSync(TEMP_MIGRATIONS_DIR, MIGRATIONS_DIR);

    console.log('5. Applying migrations...');
    // We can just run npx supabase migration up, which will apply pending migrations in order
    run('npx supabase migration up');

    console.log('6. Seeding database...');
    // Using TS seed script instead of SQL if it's there
    run('npx tsx tests/setup/seed-supabase.ts');

    console.log('\n✅ CI Setup Completed Successfully');
  } catch (error) {
    console.error('\n❌ CI Setup Failed');
    // Ensure migrations are restored if failed
    if (fs.existsSync(TEMP_MIGRATIONS_DIR)) {
      if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.renameSync(TEMP_MIGRATIONS_DIR, MIGRATIONS_DIR);
      }
    }
    process.exit(1);
  }
}

main();
