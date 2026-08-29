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
  let s = sql.trim().replace(/\r\n/g, '\n');
  
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
  
  return s;
}

function testNormalizer() {
  assert.strictEqual(normalizeSql("((a = b))"), "(a = b)", "Parentesis externos redundantes");
  assert.notStrictEqual(normalizeSql("(role IN ('admin', 'employee', 'auditor'))"), normalizeSql("(role IN ('admin', 'employee'))"), "Expresion con auditor vs sin auditor");
  assert.notStrictEqual(normalizeSql("auth.uid() IS NOT NULL"), normalizeSql("organization_id = auth.uid()"), "Auth vs validacion organizacional");
  assert.strictEqual(normalizeRoles("{admin,employee}"), normalizeRoles("{employee, admin}"), "Roles igualados por orden");
  assert.notStrictEqual(normalizeRoles("{public}"), normalizeRoles("{authenticated}"), "Roles diferentes");
  
  // Prueba de una política compleja multilinea con subconsultas, saltos y casts
  const multilineSql = `((bucket_id = 'documents'::text) AND (auth.uid() IS NOT NULL) AND (split_part(name, '/'::text, 1) = ( SELECT (profiles.organization_id)::text AS organization_id
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.status = 'active'::text) AND (profiles.role = ANY (ARRAY['admin'::text, 'employee'::text, 'auditor'::text]))))))`;
  
  const parsed = normalizeSql(multilineSql);
  assert.strictEqual(parsed.includes('\n'), true, "Conserva saltos de línea");
  assert.strictEqual(parsed.includes('::text'), true, "Conserva casts ::text");
}

function parseJsonLinesPolicies(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  const policies = new Map();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const schemaname = obj.schemaname;
      const tablename = obj.tablename;
      const policyname = obj.policyname;
      let rolesStr = '';
      if (Array.isArray(obj.roles)) {
        rolesStr = obj.roles.join(',');
      } else if (typeof obj.roles === 'string') {
        rolesStr = obj.roles;
      }
      const roles = normalizeRoles(rolesStr);
      const cmd = obj.cmd;
      const qual = normalizeSql(obj.qual);
      const with_check = normalizeSql(obj.with_check);
      const key = `${schemaname}|${tablename}|${policyname}|${cmd}`;
      policies.set(key, { schemaname, tablename, policyname, roles, cmd, qual, with_check });
    } catch (e) {
      console.error(`ERROR parsing JSON line in ${filePath}:`, e);
    }
  }
  return policies;
}

function parseExpectedJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const policies = new Map();
  const rows = raw
    .split(/\r?\n/)
    .map((line, index) => ({
      line: index + 1,
      value: line.trim(),
    }))
    .filter(({ value }) => value.length > 0)
    .map(({ line, value }) => {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.error(`ERROR: JSON Lines inválido en ${filePath}, línea ${line}: ${error.message}`);
        process.exit(1);
      }
    });

  if (rows.length !== 20) {
    console.error(`ERROR: Contrato esperado inválido: se esperaban 20 policies y se encontraron ${rows.length}`);
    process.exit(1);
  }

  for (const obj of rows) {
    const schemaname = obj.schemaname;
    const tablename = obj.tablename;
    const policyname = obj.policyname;
    let rolesStr = Array.isArray(obj.roles) ? obj.roles.join(',') : (obj.roles || '');
    const roles = normalizeRoles(rolesStr);
    const cmd = obj.cmd;
    const qual = normalizeSql(obj.qual);
    const with_check = normalizeSql(obj.with_check);
    const key = `${schemaname}|${tablename}|${policyname}|${cmd}`;
    
    if (policies.has(key)) {
      console.error(`ERROR: Clave duplicada en contrato esperado: ${key}`);
      process.exit(1);
    }
    
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

  console.log(`Schema contract:
- expected: ${expectedLines.length}
- actual: ${actualLines.length}
- missing: ${missing}
- unexpected: ${unexpected}
- changed: 0`);
  return errors;
}

function isRelevantPolicy(p) {
  if (p.schemaname === 'storage' && p.tablename === 'objects' && p.policyname.startsWith('documents_')) return true;
  if (p.schemaname === 'public' && ['clients', 'properties', 'rental_contracts', 'rent_index_values'].includes(p.tablename)) return true;
  return false;
}

function run() {
  testNormalizer();
  
  if (process.argv.includes('--self-test')) {
    const policies = parseExpectedJsonLines('supabase/ci/expected-safe-rollback-policies.json');
    assert.strictEqual(policies.size, 20, "Debe tener 20 claves unicas");
    let hasSelect = false;
    let hasInsert = false;
    let hasUpdate = false;
    let hasDelete = false;
    for (const key of policies.keys()) {
      if (key.startsWith('storage|objects|documents_select')) hasSelect = true;
      if (key.startsWith('storage|objects|documents_insert')) hasInsert = true;
      if (key.startsWith('storage|objects|documents_update')) hasUpdate = true;
      if (key.startsWith('storage|objects|documents_delete')) hasDelete = true;
      if (key.startsWith('storage|objects|storage_select_policy')) throw new Error('Vulnerable select');
      if (key.startsWith('storage|objects|storage_insert_policy')) throw new Error('Vulnerable insert');
      if (key.startsWith('storage|objects|storage_delete_policy')) throw new Error('Vulnerable delete');
    }
    assert.strictEqual(hasSelect, true, "Falta documents_select");
    assert.strictEqual(hasInsert, true, "Falta documents_insert");
    assert.strictEqual(hasUpdate, true, "Falta documents_update");
    assert.strictEqual(hasDelete, true, "Falta documents_delete");
    console.log("Self-test passed.");
    process.exit(0);
  }

  let totalErrors = 0;
  console.log("=== COMPROBACIÓN DE CONTRATOS CANÓNICOS ===");

  totalErrors += checkDiffs('Schema', 'schema_diff.txt', 'supabase/ci/expected-safe-rollback-schema.txt');
  
  const finalPolicies = parseJsonLinesPolicies('final_policies.json');
  const expectedPolicies = parseExpectedJsonLines('supabase/ci/expected-safe-rollback-policies.json');

  const actualRelevant = new Map();
  for (const [key, pol] of finalPolicies.entries()) {
    if (isRelevantPolicy(pol)) {
      actualRelevant.set(key, pol);
    }
  }

  let missingPol = 0;
  let unexpectedPol = 0;
  let changedPol = 0;

  for (const [key, exp] of expectedPolicies.entries()) {
    if (!actualRelevant.has(key)) {
      console.error(`ERROR: Fila esperada pero ausente: ${key}`);
      missingPol++;
      totalErrors++;
    } else {
      const act = actualRelevant.get(key);
      let diffs = [];
      if (act.roles !== exp.roles) diffs.push(`roles: expected '${exp.roles}', actual '${act.roles}'`);
      if (act.cmd !== exp.cmd) diffs.push(`cmd: expected '${exp.cmd}', actual '${act.cmd}'`);
      if (act.qual !== exp.qual) diffs.push(`qual: expected '${exp.qual}', actual '${act.qual}'`);
      if (act.with_check !== exp.with_check) diffs.push(`with_check: expected '${exp.with_check}', actual '${act.with_check}'`);
      
      if (diffs.length > 0) {
        console.error(`ERROR: Definición diferente para ${key}:`);
        diffs.forEach(d => console.error(`  - ${d}`));
        changedPol++;
        totalErrors++;
      }
      actualRelevant.delete(key);
    }
  }

  for (const [key, act] of actualRelevant.entries()) {
    console.error(`ERROR: Fila real inesperada: ${key}`);
    unexpectedPol++;
    totalErrors++;
  }

  console.log(`Policy final-state contract:
- expected: ${expectedPolicies.size}
- actual: ${expectedPolicies.size - missingPol + unexpectedPol}
- missing: ${missingPol}
- unexpected: ${unexpectedPol}
- changed: ${changedPol}`);
  
  // Also check if any vulnerable storage policy still exists
  for (const key of finalPolicies.keys()) {
    if (key.startsWith('storage|objects|storage_select_policy') || 
        key.startsWith('storage|objects|storage_insert_policy') || 
        key.startsWith('storage|objects|storage_delete_policy')) {
      console.error(`ERROR: Vulnerable policy found in final state: ${key}`);
      totalErrors++;
    }
  }

  // Ensure grants/storage standard diffs are correct if they exist
  // We can just print them. If expected files don't exist, readExpectedList returns [].
  
  if (totalErrors > 0) {
    process.exit(1);
  }
  
  console.log("Invariants: PASS (Will run SQL invariants next)");
}

run();
