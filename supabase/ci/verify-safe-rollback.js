const fs = require('fs');

function normalizeRoles(rolesStr) {
  if (!rolesStr || rolesStr.trim() === '' || rolesStr === 'null') return '{public}';
  let clean = rolesStr.trim().replace(/^\{|\}$/g, '');
  if (clean === '' || clean === 'public') return '{public}';
  let roles = clean.split(',').map(r => r.trim()).sort();
  return `{${roles.join(',')}}`;
}

function normalizeSql(sql) {
  if (!sql || sql.trim() === '' || sql === 'null') return 'NULL';
  let s = sql.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let isSingleGroup = true;
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      if (depth === 0) {
        isSingleGroup = false;
        break;
      }
    }
    if (isSingleGroup && depth === 1) {
      s = s.substring(1, s.length - 1).trim();
    } else {
      break;
    }
  }
  s = s.replace(/::text/g, '');
  s = s.replace(/\s*=\s*/g, ' = ');
  s = s.replace(/\s+AND\s+/ig, ' AND ');
  s = s.replace(/\s+OR\s+/ig, ' OR ');
  return s;
}

function parsePolicies(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const policies = new Map();
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 7) continue;
    const schemaname = parts[0].trim();
    const tablename = parts[1].trim();
    const policyname = parts[2].trim();
    const roles = normalizeRoles(parts[3]);
    const cmd = parts[4].trim();
    const qual = normalizeSql(parts[5]);
    const with_check = normalizeSql(parts[6]);
    const key = `${schemaname}|${tablename}|${policyname}`;
    policies.set(key, { schemaname, tablename, policyname, roles, cmd, qual, with_check });
  }
  return policies;
}

function readDiff(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split(/\r?\n/)
    .filter(l => l.match(/^[+-]/) && !l.match(/^(---|\+\+\+)/))
    .map(l => l.trim());
}

function readExpectedList(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter(l => l.trim() !== '')
    .map(l => l.trim());
}

function checkDiffs(name, diffFile, expectedFile) {
  const actualLines = readDiff(diffFile);
  const expectedLines = readExpectedList(expectedFile);
  
  let missing = 0;
  let unexpected = 0;
  let errors = 0;

  for (const exp of expectedLines) {
    if (!actualLines.includes(exp)) {
      console.error(`ERROR: ${name} esperada pero ausente: ${exp}`);
      missing++;
      errors++;
    }
  }

  for (const act of actualLines) {
    if (!expectedLines.includes(act)) {
      console.error(`ERROR: ${name} real inesperada: ${act}`);
      unexpected++;
      errors++;
    }
  }

  console.log(`${name}: expected ${expectedLines.length}, actual ${actualLines.length}, missing ${missing}, unexpected ${unexpected}`);
  return errors;
}

function run() {
  let totalErrors = 0;

  console.log("=== COMPROBACIÓN DE CONTRATOS CANÓNICOS ===");

  totalErrors += checkDiffs('Schema', 'schema_diff.txt', 'supabase/ci/expected-safe-rollback-schema.txt');
  
  const initial = parsePolicies('initial_policies.txt');
  const final = parsePolicies('final_policies.txt');
  
  const expectedText = fs.readFileSync('supabase/ci/expected-safe-rollback-policies.tsv', 'utf-8');
  const expectedOverrides = new Map();
  expectedText.split(/\r?\n/).filter(l => l.trim() !== '').forEach(line => {
    const parts = line.split('\t');
    if (parts.length < 8) return;
    const schemaname = parts[0].trim();
    const tablename = parts[1].trim();
    const policyname = parts[2].trim();
    const roles = normalizeRoles(parts[3]);
    const cmd = parts[4].trim();
    const qual = normalizeSql(parts[5]);
    const with_check = normalizeSql(parts[6]);
    const expectedChange = parts[7].trim();
    const key = `${schemaname}|${tablename}|${policyname}`;
    expectedOverrides.set(key, { schemaname, tablename, policyname, roles, cmd, qual, with_check, expectedChange });
  });

  const actualAdditions = new Map();
  const actualDeletions = new Map();
  
  for (const [key, pol] of final.entries()) {
    if (!initial.has(key)) {
      actualAdditions.set(key, pol);
    } else {
      const initPol = initial.get(key);
      if (initPol.qual !== pol.qual || initPol.with_check !== pol.with_check || initPol.roles !== pol.roles || initPol.cmd !== pol.cmd) {
        console.error(`ERROR: Policy modified unexpectedly: ${key}`);
        totalErrors++;
      }
    }
  }

  for (const [key, pol] of initial.entries()) {
    if (!final.has(key)) {
      actualDeletions.set(key, pol);
    }
  }

  let missingPol = 0;
  let unexpectedPol = 0;

  for (const [key, exp] of expectedOverrides.entries()) {
    if (exp.expectedChange === 'ADDED') {
      if (!actualAdditions.has(key)) {
        console.error(`ERROR: Fila esperada pero ausente (ADDED): ${key}`);
        missingPol++;
        totalErrors++;
      } else {
        const act = actualAdditions.get(key);
        let diffs = [];
        if (act.roles !== exp.roles) diffs.push(`roles: expected '${exp.roles}', actual '${act.roles}'`);
        if (act.cmd !== exp.cmd) diffs.push(`cmd: expected '${exp.cmd}', actual '${act.cmd}'`);
        if (act.qual !== exp.qual) diffs.push(`qual: expected '${exp.qual}', actual '${act.qual}'`);
        if (act.with_check !== exp.with_check) diffs.push(`with_check: expected '${exp.with_check}', actual '${act.with_check}'`);
        
        if (diffs.length > 0) {
          console.error(`ERROR: Definición diferente para ${key}:`);
          diffs.forEach(d => console.error(`  - ${d}`));
          totalErrors++;
        }
        actualAdditions.delete(key);
      }
    } else if (exp.expectedChange === 'REMOVED') {
      if (!actualDeletions.has(key)) {
        console.error(`ERROR: Fila esperada pero ausente (REMOVED): ${key}`);
        missingPol++;
        totalErrors++;
      } else {
        const act = actualDeletions.get(key);
        let diffs = [];
        if (act.roles !== exp.roles) diffs.push(`roles: expected '${exp.roles}', actual '${act.roles}'`);
        if (act.cmd !== exp.cmd) diffs.push(`cmd: expected '${exp.cmd}', actual '${act.cmd}'`);
        if (act.qual !== exp.qual) diffs.push(`qual: expected '${exp.qual}', actual '${act.qual}'`);
        if (act.with_check !== exp.with_check) diffs.push(`with_check: expected '${exp.with_check}', actual '${act.with_check}'`);
        
        if (diffs.length > 0) {
          console.error(`ERROR: Definición diferente para ${key}:`);
          diffs.forEach(d => console.error(`  - ${d}`));
          totalErrors++;
        }
        actualDeletions.delete(key);
      }
    }
  }

  for (const [key, act] of actualAdditions.entries()) {
    console.error(`ERROR: Fila real inesperada (ADDED): ${key}`);
    unexpectedPol++;
    totalErrors++;
  }
  for (const [key, act] of actualDeletions.entries()) {
    console.error(`ERROR: Fila real inesperada (REMOVED): ${key}`);
    unexpectedPol++;
    totalErrors++;
  }

  console.log(`Policies: expected ${expectedOverrides.size}, actual ${expectedOverrides.size - missingPol + unexpectedPol}, missing ${missingPol}, unexpected ${unexpectedPol}`);
  
  totalErrors += checkDiffs('Storage', 'storage_diff.txt', 'supabase/ci/expected-safe-rollback-storage.txt');
  totalErrors += checkDiffs('Grants', 'grants_diff.txt', 'supabase/ci/expected-safe-rollback-grants.txt');

  if (totalErrors > 0) {
    process.exit(1);
  }
  
  console.log("Invariants: PASS (Will run SQL invariants next)");
}

run();
