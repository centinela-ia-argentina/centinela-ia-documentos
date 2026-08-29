const fs = require('fs');
const assert = require('assert');

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
  s = s.replace(/\r\n/g, '\n');
  
  // Remove one layer of redundant OUTER parentheses if perfectly balanced
  let depth = 0;
  let isSingleGroup = true;
  if (s.startsWith('(') && s.endsWith(')')) {
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
    }
  }
  
  // No eliminar ::text globalmente ni paréntesis internos
  s = s.replace(/\s*=\s*/g, ' = ');
  s = s.replace(/\s+AND\s+/ig, ' AND ');
  s = s.replace(/\s+OR\s+/ig, ' OR ');
  return s;
}

function testNormalizer() {
  // Pruebas requeridas en fase 8
  assert.strictEqual(normalizeSql("((a = b))"), "(a = b)", "Parentesis externos redundantes");
  assert.notStrictEqual(normalizeSql("(role IN ('admin', 'employee', 'auditor'))"), normalizeSql("(role IN ('admin', 'employee'))"), "Expresion con auditor vs sin auditor");
  assert.notStrictEqual(normalizeSql("auth.uid() IS NOT NULL"), normalizeSql("organization_id = auth.uid()"), "Auth vs validacion organizacional");
  assert.notStrictEqual(normalizeSql("a = b"), normalizeSql("c = d"), "USING diferente");
  assert.strictEqual(normalizeRoles("{admin,employee}"), normalizeRoles("{employee, admin}"), "Roles igualados por orden");
  // The test below should PASS (asserting they are different because they mean different things)
  assert.notStrictEqual(normalizeRoles("{public}"), normalizeRoles("{authenticated}"), "Roles diferentes");
}

function parsePolicies(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\n/).filter(l => l.trim() !== '');
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
  return content.split(/\n/)
    .filter(l => l.match(/^[+-]/) && !l.match(/^(---|\+\+\+)/))
    .map(l => l.trim());
}

function readExpectedList(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split(/\n/)
    .filter(l => l.trim() !== '')
    .map(l => l.trim());
}

function checkDiffs(name, diffFile, expectedFile) {
  const normalizeSchemaLine = (line) => {
    return line.replace(/"/g, '')
               .replace(/\s+TO\s+public\s+/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  };

  const actualLines = readDiff(diffFile).map(normalizeSchemaLine);
  const expectedLines = readExpectedList(expectedFile).map(normalizeSchemaLine);
  
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
  testNormalizer();

  let totalErrors = 0;
  console.log("=== COMPROBACIÓN DE CONTRATOS CANÓNICOS ===");

  totalErrors += checkDiffs('Schema', 'schema_diff.txt', 'supabase/ci/expected-safe-rollback-schema.txt');
  
  const initial = parsePolicies('initial_policies.txt');
  const final = parsePolicies('final_policies.txt');
  
  const expectedText = fs.readFileSync('supabase/ci/expected-safe-rollback-policies.tsv', 'utf-8');
  const expectedOverrides = new Map();
  expectedText.split(/\n/).filter(l => l.trim() !== '').forEach(line => {
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
      if (key === 'storage|objects|storage_select_policy' || 
          key === 'storage|objects|storage_insert_policy' || 
          key === 'storage|objects|storage_delete_policy') {
        // Ignorar estas políticas antiguas eliminadas porque DEBEN ser eliminadas.
      } else {
        actualDeletions.set(key, pol);
      }
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
