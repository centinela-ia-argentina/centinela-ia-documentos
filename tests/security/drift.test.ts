import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials for drift tests.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('Drift Repair: checklist_items.organization_id', () => {
  
  // Helper to run raw SQL using psql CLI
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
    execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -f supabase/migrations/20260822000000_repair_checklist_drift.sql`, { stdio: 'pipe' });
  };

  const applyRollback = () => {
    execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -f supabase/rollbacks/20260822000000_repair_checklist_drift.rollback.sql`, { stdio: 'pipe' });
  };

  let orgId1: string;
  let orgId2: string;
  let caseId1: string;
  let caseId2: string;
  let chkId1: string;
  let chkId2: string;
  let docId1: string;
  let docId2: string;

  beforeAll(async () => {
    // Seed basic data for tests
    const orgRes1 = await supabase.from('organizations').insert({ name: 'Drift Org 1', plan: 'starter' }).select('id').single();
    if (orgRes1.data) orgId1 = orgRes1.data.id;
    
    const orgRes2 = await supabase.from('organizations').insert({ name: 'Drift Org 2', plan: 'starter' }).select('id').single();
    if (orgRes2.data) orgId2 = orgRes2.data.id;

    const caseRes1 = await supabase.from('cases').insert({ organization_id: orgId1, title: 'C1', client_name: 'CLI', case_type: 'generic' }).select('id').single();
    if (caseRes1.data) caseId1 = caseRes1.data.id;
    
    const caseRes2 = await supabase.from('cases').insert({ organization_id: orgId2, title: 'C2', client_name: 'CLI', case_type: 'generic' }).select('id').single();
    if (caseRes2.data) caseId2 = caseRes2.data.id;

    const docRes1 = await supabase.from('documents').insert({ organization_id: orgId1, case_id: caseId1, file_name: 'D1' }).select('id').single();
    if (docRes1.data) docId1 = docRes1.data.id;

    const docRes2 = await supabase.from('documents').insert({ organization_id: orgId2, case_id: caseId2, file_name: 'D2' }).select('id').single();
    if (docRes2.data) docId2 = docRes2.data.id;

    const chkRes1 = await supabase.from('checklists').insert({ organization_id: orgId1, case_id: caseId1, name: 'CHK1' }).select('id').single();
    if (chkRes1.data) chkId1 = chkRes1.data.id;
    
    const chkRes2 = await supabase.from('checklists').insert({ organization_id: orgId2, case_id: caseId2, name: 'CHK2' }).select('id').single();
    if (chkRes2.data) chkId2 = chkRes2.data.id;
  });

  afterAll(async () => {
    // Cleanup
    if (orgId1) await supabase.from('organizations').delete().eq('id', orgId1);
    if (orgId2) await supabase.from('organizations').delete().eq('id', orgId2);
  });

  it('1. Simular drift: eliminar organization_id de checklist_items y crear items', async () => {
    // Para simular el drift, eliminamos la columna que el baseline pudo haber creado localmente
    // Solo en este entorno de testing controlado.
    runSql(`ALTER TABLE public.checklist_items DROP COLUMN IF EXISTS organization_id CASCADE;`);
    
    // Insertamos ítems (sin organization_id, directo por SQL porque el cliente JS fallara si el esquema TypeScript espera orgId)
    runSql(`INSERT INTO public.checklist_items (checklist_id, title) VALUES ('${chkId1}', 'Item Drift 1');`);
    runSql(`INSERT INTO public.checklist_items (checklist_id, title, document_id) VALUES ('${chkId2}', 'Item Drift 2', '${docId2}');`);

    // Comprobamos que existen y la tabla no tiene organization_id
    let hasColumn = true;
    try {
      runSql(`SELECT organization_id FROM public.checklist_items LIMIT 1;`);
    } catch (e) {
      hasColumn = false;
    }
    expect(hasColumn).toBe(false);
  });

  it('2. Aplicar migracin: backfill completo, constraints y triggers', async () => {
    applyMigration();
    
    // Verificamos que se restaur y backfille correctamente
    const { data, error } = await supabase.from('checklist_items').select('organization_id, checklist_id').in('checklist_id', [chkId1, chkId2]);
    expect(error).toBeNull();
    expect(data?.length).toBe(2);
    
    const item1 = data!.find(d => d.checklist_id === chkId1);
    const item2 = data!.find(d => d.checklist_id === chkId2);
    
    expect(item1?.organization_id).toBe(orgId1);
    expect(item2?.organization_id).toBe(orgId2);
  });

  it('3. Rechazo de cruces de organizacin (Trigger)', async () => {
    // Intentar insertar un item en CHK1 (Org 1) asignando explcitamente Org 2
    const { error: err1 } = await supabase.from('checklist_items').insert({
      checklist_id: chkId1,
      organization_id: orgId2,
      title: 'Invalid Org'
    });
    expect(err1).not.toBeNull();
    expect(err1?.message).toContain('must match checklist organization_id');

    // Intentar insertar un item en CHK1 (Org 1) con un documento de Org 2
    const { error: err2 } = await supabase.from('checklist_items').insert({
      checklist_id: chkId1,
      organization_id: orgId1,
      document_id: docId2,
      title: 'Invalid Doc'
    });
    expect(err2).not.toBeNull();
    expect(err2?.message).toContain('document organization_id');
  });

  it('4. Idempotencia: aplicar migracin nuevamente no rompe nada', async () => {
    // Reaplicamos
    expect(() => applyMigration()).not.toThrow();
  });

  it('5. Rollback state-aware', async () => {
    // El rollback debera borrar el trigger y la funcin, y tambin borrar la columna 
    // porque detecta el comentario 'added_by_drift_repair'
    applyRollback();
    
    let hasTrigger = true;
    try {
      runSql(`SELECT public.check_checklist_item_org_drift_repair();`);
    } catch (e: any) {
      if (e.message.includes('does not exist')) hasTrigger = false;
    }
    expect(hasTrigger).toBe(false);

    let hasColumn = true;
    try {
      runSql(`SELECT organization_id FROM public.checklist_items LIMIT 1;`);
    } catch (e) {
      hasColumn = false;
    }
    expect(hasColumn).toBe(false);
  });

  it('6. Reaplicacin: volver a subir despus de rollback', async () => {
    applyMigration();
    
    const { data, error } = await supabase.from('checklist_items').select('organization_id, checklist_id').eq('checklist_id', chkId1);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data![0].organization_id).toBe(orgId1);
  });
});
