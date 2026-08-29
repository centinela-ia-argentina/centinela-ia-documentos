const fs = require('fs');
const path = require('path');

function normalizeQual(str) {
  if (!str) return '';
  return str.replace(/\s+/g, '').replace(/::text/g, '');
}

function parsePolicies(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  const policies = new Map();
  for (const line of lines) {
    const parts = line.split('|');
    const schemaname = parts[0];
    const tablename = parts[1];
    const policyname = parts[2];
    const roles = parts[3];
    const cmd = parts[4];
    const qual = parts[5];
    const with_check = parts[6];
    const key = `${schemaname}|${tablename}|${policyname}`;
    policies.set(key, {
      schemaname,
      tablename,
      policyname,
      roles: roles || '',
      cmd: cmd || '',
      qual: normalizeQual(qual),
      with_check: normalizeQual(with_check),
      rawQual: qual,
      rawWithCheck: with_check
    });
  }
  return policies;
}

function run() {
  const initial = parsePolicies('initial_policies.txt');
  const final = parsePolicies('final_policies.txt');
  const expectedText = fs.readFileSync('supabase/ci/expected-safe-rollback-policies.tsv', 'utf-8');
  
  const expectedOverrides = new Map();
  expectedText.split('\n').filter(l => l.trim() !== '').forEach(line => {
    const parts = line.split('\t');
    const schemaname = parts[0];
    const tablename = parts[1];
    const policyname = parts[2];
    const roles = parts[3];
    const cmd = parts[4];
    const qual = parts[5];
    const with_check = parts[6];
    const expectedChange = parts[7];
    const key = `${schemaname}|${tablename}|${policyname}`;
    expectedOverrides.set(key, {
      schemaname, tablename, policyname, roles, cmd, 
      qual: normalizeQual(qual), 
      with_check: normalizeQual(with_check),
      expectedChange
    });
  });

  const actualAdditions = [];
  const actualDeletions = [];
  
  for (const [key, pol] of final.entries()) {
    if (!initial.has(key)) {
      actualAdditions.push(pol);
    } else {
      const initPol = initial.get(key);
      if (initPol.qual !== pol.qual || initPol.with_check !== pol.with_check || initPol.roles !== pol.roles || initPol.cmd !== pol.cmd) {
        console.error(`ERROR: Policy modified unexpectedly: ${key}`);
        process.exit(1);
      }
    }
  }

  for (const [key, pol] of initial.entries()) {
    if (!final.has(key)) {
      actualDeletions.push(pol);
    }
  }

  let errors = 0;
  let matchedOverrides = 0;

  for (const add of actualAdditions) {
    const key = `${add.schemaname}|${add.tablename}|${add.policyname}`;
    const exp = expectedOverrides.get(key);
    if (!exp || exp.expectedChange !== 'ADDED') {
      console.error(`ERROR: Unauthorized policy ADDED: ${key}`);
      errors++;
      continue;
    }
    if (add.roles !== exp.roles || add.cmd !== exp.cmd || add.qual !== exp.qual || add.with_check !== exp.with_check) {
      console.error(`ERROR: Policy ADDED with wrong definition: ${key}`);
      errors++;
    } else {
      matchedOverrides++;
    }
  }

  for (const del of actualDeletions) {
    const key = `${del.schemaname}|${del.tablename}|${del.policyname}`;
    const exp = expectedOverrides.get(key);
    if (!exp || exp.expectedChange !== 'REMOVED') {
      console.error(`ERROR: Unauthorized policy REMOVED: ${key}`);
      errors++;
      continue;
    }
    matchedOverrides++;
  }

  if (matchedOverrides !== expectedOverrides.size) {
    console.error(`ERROR: Expected ${expectedOverrides.size} policy changes, but matched ${matchedOverrides}.`);
    errors++;
  }

  if (errors > 0) {
    console.error(`FAILURE: Secure rollback contract violated.`);
    process.exit(1);
  }

  console.log(`SUCCESS: All ${matchedOverrides} policy changes matched the secure rollback contract exactly.`);
}
run();
