import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { SEED_DATA } from '../setup/seed-supabase';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials for RLS tests.');
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runSql = (sql: string) => {
  try {
    execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "${sql}"`, { stdio: 'pipe' });
  } catch (e: any) {
    if (e.stderr) {
      throw new Error(e.stderr.toString());
    }
    throw e;
  }
};

const applyMigration = () => {
  execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -f supabase/migrations/20260822180000_repair_checklist_items_delete_rls.sql`, { stdio: 'pipe' });
};

const applyRollback = () => {
  execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -f supabase/rollbacks/20260822180000_repair_checklist_items_delete_rls.rollback.sql`, { stdio: 'pipe' });
};

describe('Checklist Items DELETE RLS', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
  let inactiveALegal: any;
  let adminBInm: any;
  let anonClient: any;

  let chkLegalId: string;
  let chkInmId: string;

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }
    if (supabaseUrl.includes('supabase.co')) {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Detectada URL de Production.');
    }

    // 1. Log in users
    anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const login = async (email: string) => {
      const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
      if (error || !data.session) throw new Error(`Login failed for ${email}`);
      return client;
    };

    adminALegal = await login('admin.legal@test.com');
    employeeALegal = await login('emp.legal@test.com');
    auditorALegal = await login('auditor.legal@test.com');
    clientALegal = await login('client.assigned@test.com');
    inactiveALegal = await login('inactive.legal@test.com');
    adminBInm = await login('admin.inm@test.com');

    // 2. Create base checklists using service role
    chkLegalId = randomUUID();
    chkInmId = randomUUID();

    await serviceClient.from('checklists').insert([
      { id: chkLegalId, organization_id: SEED_DATA.ORG_LEGAL_ID, case_id: SEED_DATA.CASE_LEGAL_ID, name: 'CHK Legal' },
      { id: chkInmId, organization_id: SEED_DATA.ORG_INM_ID, case_id: SEED_DATA.CASE_INM_ID, name: 'CHK Inm' }
    ]);
  });

  afterAll(async () => {
    // Cleanup Checklists (CASCADE deletes items)
    await serviceClient.from('checklists').delete().in('id', [chkLegalId, chkInmId]);
    applyMigration(); // Ensure it ends in migrated state for other suites
  });

  // Helper to create an item and return its ID
  const createItem = async (orgId: string, chkId: string) => {
    const id = randomUUID();
    const { error } = await serviceClient.from('checklist_items').insert({
      id,
      organization_id: orgId,
      checklist_id: chkId,
      title: 'Item to delete'
    });
    if (error) throw error;
    return id;
  };

  it('Aplica la migracion', () => {
    expect(() => applyMigration()).not.toThrow();
  });

  // --- REGRESSION TESTS (BASELINE POLICIES) ---

  it('R1. Admin activo puede leer checklist_items de su organizacion', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await adminALegal.from('checklist_items').select('id').eq('id', itemId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('R2. Employee activo puede leer checklist_items de su organizacion', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await employeeALegal.from('checklist_items').select('id').eq('id', itemId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('R3. Auditor activo puede leer checklist_items de su organizacion', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await auditorALegal.from('checklist_items').select('id').eq('id', itemId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('R4. Client asignado al expediente puede leer sus checklist_items', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await clientALegal.from('checklist_items').select('id').eq('id', itemId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('R5. Client no asignado no puede leer checklist_items del expediente', async () => {
    const clientUnassigned = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await clientUnassigned.auth.signInWithPassword({ email: 'client.unassigned@test.com', password: 'password123' });
    expect(authError).toBeNull();
    expect(authData.session).not.toBeNull();
    
    // Check that profile is correct
    const prof = await serviceClient.from('profiles').select('status, role, organization_id').eq('id', authData.user?.id).single();
    expect(prof.data?.status).toBe('active');
    expect(prof.data?.role).toBe('client');
    expect(prof.data?.organization_id).toBe(SEED_DATA.ORG_LEGAL_ID);

    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await clientUnassigned.from('checklist_items').select('id').eq('id', itemId);
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it('R6. Usuario inactivo no puede leer', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await inactiveALegal.from('checklist_items').select('id').eq('id', itemId);
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it('R7. Usuario de otra organizacion no puede leer', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await adminBInm.from('checklist_items').select('id').eq('id', itemId);
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it('R8. Admin y employee pueden insertar en checklist de su organizacion', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    
    const res1 = await adminALegal.from('checklist_items').insert({ id: id1, organization_id: SEED_DATA.ORG_LEGAL_ID, checklist_id: chkLegalId, title: 'I1' });
    expect(res1.error).toBeNull();

    const res2 = await employeeALegal.from('checklist_items').insert({ id: id2, organization_id: SEED_DATA.ORG_LEGAL_ID, checklist_id: chkLegalId, title: 'I2' });
    expect(res2.error).toBeNull();

    const check1 = await serviceClient.from('checklist_items').select('id').eq('id', id1).single();
    expect(check1.error).toBeNull();
    expect(check1.data).not.toBeNull();

    const check2 = await serviceClient.from('checklist_items').select('id').eq('id', id2).single();
    expect(check2.error).toBeNull();
    expect(check2.data).not.toBeNull();
  });

  it('R9. Auditor y client no pueden insertar', async () => {
    const res1 = await auditorALegal.from('checklist_items').insert({ organization_id: SEED_DATA.ORG_LEGAL_ID, checklist_id: chkLegalId, title: 'IX' });
    expect(res1.error).not.toBeNull();

    const res2 = await clientALegal.from('checklist_items').insert({ organization_id: SEED_DATA.ORG_LEGAL_ID, checklist_id: chkLegalId, title: 'IY' });
    expect(res2.error).not.toBeNull();
  });

  it('R10. Admin y employee pueden actualizar items del checklist de su organizacion', async () => {
    const itemId1 = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const res1 = await adminALegal.from('checklist_items').update({ title: 'U1' }).eq('id', itemId1).select('id, title');
    expect(res1.error).toBeNull();
    expect(res1.data ?? []).toHaveLength(1);
    if (res1.data && res1.data.length > 0) expect(res1.data[0].title).toBe('U1');

    const check1 = await serviceClient.from('checklist_items').select('title').eq('id', itemId1).single();
    expect(check1.data?.title).toBe('U1');

    const itemId2 = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const res2 = await employeeALegal.from('checklist_items').update({ title: 'U2' }).eq('id', itemId2).select('id, title');
    expect(res2.error).toBeNull();
    expect(res2.data ?? []).toHaveLength(1);
    if (res2.data && res2.data.length > 0) expect(res2.data[0].title).toBe('U2');

    const check2 = await serviceClient.from('checklist_items').select('title').eq('id', itemId2).single();
    expect(check2.data?.title).toBe('U2');
  });

  it('R11. Auditor, client, inactivo y otro tenant no pueden actualizar', async () => {
    const checkUpdateDenied = async (client: any) => {
      const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
      const originalCheck = await serviceClient.from('checklist_items').select('title').eq('id', itemId).single();
      const originalTitle = originalCheck.data?.title;

      const result = await client.from('checklist_items').update({ title: 'UX' }).eq('id', itemId).select();
      if (result.error === null) {
        expect(result.data ?? []).toHaveLength(0);
      }

      const persisted = await serviceClient.from('checklist_items').select('title').eq('id', itemId).single();
      expect(persisted.data?.title).toBe(originalTitle);
    };

    await checkUpdateDenied(auditorALegal);
    await checkUpdateDenied(clientALegal);
    await checkUpdateDenied(inactiveALegal);
    await checkUpdateDenied(adminBInm);
  });

  it('R12. UPDATE no puede mover o modificar una fila hacia un checklist de otra organizacion', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    
    const result = await adminALegal
      .from('checklist_items')
      .update({ checklist_id: chkInmId })
      .eq('id', itemId)
      .select('id, checklist_id');

    if (result.error === null) {
      expect(result.data ?? []).toHaveLength(0);
    }

    const persisted = await serviceClient
      .from('checklist_items')
      .select('id, checklist_id, organization_id')
      .eq('id', itemId)
      .single();

    expect(persisted.error).toBeNull();
    expect(persisted.data?.checklist_id).toBe(chkLegalId);
    expect(persisted.data?.organization_id).toBe(SEED_DATA.ORG_LEGAL_ID);
  });

  it('R15. UPDATE contiene USING y WITH CHECK', () => {
    const usingRes = execSync(`psql "${DB_URL}" -t -c "SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklist_items' AND policyname = 'checklist_items_update_operator';"`, { stdio: 'pipe' });
    const checkRes = execSync(`psql "${DB_URL}" -t -c "SELECT with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklist_items' AND policyname = 'checklist_items_update_operator';"`, { stdio: 'pipe' });
    
    expect(usingRes.toString().trim().length).toBeGreaterThan(0);
    expect(checkRes.toString().trim().length).toBeGreaterThan(0);
  });

  // --- DELETE TESTS ---

  it('1. Admin activo Org A puede eliminar item Org A', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error } = await adminALegal.from('checklist_items').delete().eq('id', itemId);
    expect(error).toBeNull();
    
    // Verificamos que realmente se elimino
    const { data } = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(data ?? []).toHaveLength(0);
  });

  it('2. Employee activo Org A puede eliminar item Org A', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error } = await employeeALegal.from('checklist_items').delete().eq('id', itemId);
    expect(error).toBeNull();
    
    const { data } = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(data ?? []).toHaveLength(0);
  });

  it('3. Auditor Org A no puede eliminar', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error, data } = await auditorALegal.from('checklist_items').delete().eq('id', itemId).select();
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
    
    // El service client confirma que el item sigue existiendo
    const check = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(check.data ?? []).toHaveLength(1);
  });

  it('4. Client Org A no puede eliminar', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error, data } = await clientALegal.from('checklist_items').delete().eq('id', itemId).select();
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
    
    const check = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(check.data ?? []).toHaveLength(1);
  });

  it('5. Usuario inactivo no puede eliminar', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error, data } = await inactiveALegal.from('checklist_items').delete().eq('id', itemId).select();
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
    
    const check = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(check.data ?? []).toHaveLength(1);
  });

  it('6. Admin Org B no puede eliminar item Org A', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { error, data } = await adminBInm.from('checklist_items').delete().eq('id', itemId).select();
    if (error === null) {
      expect(data ?? []).toHaveLength(0);
    }
    
    const check = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(check.data ?? []).toHaveLength(1);
  });

  it('7. Anon no puede eliminar', async () => {
    const itemId = await createItem(SEED_DATA.ORG_LEGAL_ID, chkLegalId);
    const { data, error } = await anonClient.from('checklist_items').delete().eq('id', itemId).select();
    // anon podria arrojar error por la falta de GRANT
    if (error) {
      expect(error.code).toBe('42501'); // permission denied
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    
    const check = await serviceClient.from('checklist_items').select('id').eq('id', itemId);
    expect(check.data ?? []).toHaveLength(1);
  });

  it('9. La segunda aplicacion de la migracion no falla', () => {
    expect(() => applyMigration()).not.toThrow();
  });

  it('10. Existe exactamente una politica checklist_items_delete_operator', () => {
    const res = execSync(`psql "${DB_URL}" -t -c "SELECT count(*) FROM pg_policies WHERE tablename = 'checklist_items' AND policyname = 'checklist_items_delete_operator';"`, { stdio: 'pipe' });
    expect(parseInt(res.toString().trim(), 10)).toBe(1);
  });

  it('11. anon no tiene privilegios de tabla en checklist_items', () => {
    const sel = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'SELECT');"`, { stdio: 'pipe' });
    const ins = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'INSERT');"`, { stdio: 'pipe' });
    const upd = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'UPDATE');"`, { stdio: 'pipe' });
    const del = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'DELETE');"`, { stdio: 'pipe' });
    const trun = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'TRUNCATE');"`, { stdio: 'pipe' });
    const ref = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'REFERENCES');"`, { stdio: 'pipe' });
    const trig = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('anon', 'public.checklist_items', 'TRIGGER');"`, { stdio: 'pipe' });

    expect(sel.toString().trim()).toBe('f');
    expect(ins.toString().trim()).toBe('f');
    expect(upd.toString().trim()).toBe('f');
    expect(del.toString().trim()).toBe('f');
    expect(trun.toString().trim()).toBe('f');
    expect(ref.toString().trim()).toBe('f');
    expect(trig.toString().trim()).toBe('f');
  });

  it('11.5. No existe ninguna politica FOR ALL en checklist_items', () => {
    const res = execSync(`psql "${DB_URL}" -t -c "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checklist_items' AND cmd = 'ALL';"`, { stdio: 'pipe' });
    expect(parseInt(res.toString().trim(), 10)).toBe(0);
  });

  it('12. authenticated conserva SELECT, INSERT, UPDATE y DELETE', () => {
    const sel = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'SELECT');"`, { stdio: 'pipe' });
    const ins = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'INSERT');"`, { stdio: 'pipe' });
    const upd = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'UPDATE');"`, { stdio: 'pipe' });
    const del = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'DELETE');"`, { stdio: 'pipe' });
    expect(sel.toString().trim()).toBe('t');
    expect(ins.toString().trim()).toBe('t');
    expect(upd.toString().trim()).toBe('t');
    expect(del.toString().trim()).toBe('t');
  });

  it('13. authenticated no posee TRUNCATE, REFERENCES ni TRIGGER', () => {
    const trun = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'TRUNCATE');"`, { stdio: 'pipe' });
    const ref = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'REFERENCES');"`, { stdio: 'pipe' });
    const trig = execSync(`psql "${DB_URL}" -t -c "SELECT has_table_privilege('authenticated', 'public.checklist_items', 'TRIGGER');"`, { stdio: 'pipe' });
    expect(trun.toString().trim()).toBe('f');
    expect(ref.toString().trim()).toBe('f');
    expect(trig.toString().trim()).toBe('f');
  });

  it('14. El rollback elimina la politica propia', () => {
    applyRollback();
    const res = execSync(`psql "${DB_URL}" -t -c "SELECT count(*) FROM pg_policies WHERE tablename = 'checklist_items' AND policyname = 'checklist_items_delete_operator';"`, { stdio: 'pipe' });
    expect(parseInt(res.toString().trim(), 10)).toBe(0);
  });

  it('15. Despues del rollback, las politicas originales SELECT/INSERT/UPDATE continuan intactas', () => {
    const res = execSync(`psql "${DB_URL}" -t -c "SELECT count(*) FROM pg_policies WHERE tablename = 'checklist_items' AND policyname IN ('checklist_items_insert_operator', 'checklist_items_select_by_role', 'checklist_items_update_operator');"`, { stdio: 'pipe' });
    expect(parseInt(res.toString().trim(), 10)).toBe(3);
  });

  it('16. Reaplicacion posterior al rollback funciona', () => {
    expect(() => applyMigration()).not.toThrow();
  });

});
