import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials for Storage RLS tests.');
}

// Custom expectation function as requested
const expectObjectNotVisible = (result: { data: any[] | null, error: any }, expectedFileName: string) => {
  if (result.error) {
    // Si existe error, es una denegación segura.
    return;
  }
  // Si error es null, data no debe contener el archivo conocido.
  const found = result.data?.some((f: any) => f.name === expectedFileName);
  expect(found).not.toBe(true);
};

describe('Storage RLS Policies (documents_*) con objetos reales', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
  let inactiveALegal: any;
  let adminBInm: any;
  let anonClient: any;

  // Paths trackeados para cleanup
  const pathsToCleanupA: string[] = [];
  const pathsToCleanupB: string[] = [];

  beforeAll(async () => {
    const login = async (email: string) => {
      const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      return client;
    };

    adminALegal = await login('admin.legal@test.com');
    employeeALegal = await login('emp.legal@test.com');
    auditorALegal = await login('auditor.legal@test.com');
    clientALegal = await login('client.assigned@test.com');
    inactiveALegal = await login('inactive.legal@test.com');
    adminBInm = await login('admin.inm@test.com');
    
    anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    // Limpieza determinística por los respectivos admins
    if (pathsToCleanupA.length > 0) {
      await adminALegal.storage.from('documents').remove(pathsToCleanupA);
    }
    if (pathsToCleanupB.length > 0) {
      await adminBInm.storage.from('documents').remove(pathsToCleanupB);
    }
  });

  const uploadFile = async (client: any, path: string, content: string = 'test content') => {
    return client.storage.from('documents').upload(path, new Blob([content]), { upsert: false });
  };

  const updateFile = async (client: any, path: string) => {
    return client.storage.from('documents').update(path, new Blob(['updated content']), { upsert: true });
  };

  const deleteFile = async (client: any, path: string) => {
    return client.storage.from('documents').remove([path]);
  };

  const listFiles = async (client: any, path: string) => {
    return client.storage.from('documents').list(path);
  };

  it('1. Admin A: INSERT, SELECT, UPDATE y DELETE permitidos', async () => {
    const filename = `test_admin_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    
    // INSERT permitido
    const { error: insertErr } = await uploadFile(adminALegal, path);
    expect(insertErr).toBeNull();
    pathsToCleanupA.push(path); // Por si falla a medias

    // SELECT permitido y objeto visible
    const { data: listData, error: listErr } = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();
    expect(listData?.some((f: any) => f.name === filename)).toBe(true);

    // UPDATE permitido
    const { error: updateErr } = await updateFile(adminALegal, path);
    expect(updateErr).toBeNull();

    // DELETE permitido
    const { error: deleteErr } = await deleteFile(adminALegal, path);
    expect(deleteErr).toBeNull();
    
    // Lo sacamos de limpieza porque ya lo borró
    pathsToCleanupA.pop();
  });

  it('2. Employee A: INSERT, SELECT, UPDATE permitidos. DELETE rechazado', async () => {
    const filename = `test_employee_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    
    // INSERT permitido
    const { error: insertErr } = await uploadFile(employeeALegal, path);
    expect(insertErr).toBeNull();
    pathsToCleanupA.push(path); // Cleanup required by Admin A later

    // SELECT permitido y objeto visible
    const { data: listData, error: listErr } = await listFiles(employeeALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();
    expect(listData?.some((f: any) => f.name === filename)).toBe(true);

    // UPDATE permitido
    const { error: updateErr } = await updateFile(employeeALegal, path);
    expect(updateErr).toBeNull();

    // DELETE rechazado sobre objeto existente
    const { error: deleteErr } = await deleteFile(employeeALegal, path);
    expect(deleteErr).not.toBeNull();

    // Objeto sigue existiendo (verificado por Admin A)
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('3. Auditor A: SELECT permitido sobre objeto real. Resto rechazado sin alterar', async () => {
    const filename = `test_auditor_target_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_auditor_insert_${randomUUID()}.txt`;

    // Setup: crear objeto real con Admin A
    await uploadFile(adminALegal, path);
    pathsToCleanupA.push(path);

    // SELECT permitido y objeto real visible
    const { data: listData, error: listErr } = await listFiles(auditorALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();
    expect(listData?.some((f: any) => f.name === filename)).toBe(true);

    // INSERT rechazado
    const { error: insertErr } = await uploadFile(auditorALegal, insertPath);
    expect(insertErr).not.toBeNull();

    // UPDATE rechazado sobre objeto existente
    const { error: updateErr } = await updateFile(auditorALegal, path);
    expect(updateErr).not.toBeNull();

    // DELETE rechazado sobre objeto existente
    const { error: deleteErr } = await deleteFile(auditorALegal, path);
    expect(deleteErr).not.toBeNull();

    // Verificamos que el objeto permanece intacto con adminALegal
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('4. Client A: objeto real no visible y mutaciones rechazadas', async () => {
    const filename = `test_client_target_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_client_insert_${randomUUID()}.txt`;

    // Setup: crear objeto real
    await uploadFile(adminALegal, path);
    pathsToCleanupA.push(path);

    // Objeto real no visible
    const listResult = await listFiles(clientALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    // INSERT rechazado
    const { error: insertErr } = await uploadFile(clientALegal, insertPath);
    expect(insertErr).not.toBeNull();

    // UPDATE y DELETE rechazados sobre objeto existente
    expect((await updateFile(clientALegal, path)).error).not.toBeNull();
    expect((await deleteFile(clientALegal, path)).error).not.toBeNull();

    // Verificamos persistencia
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('5. Admin A contra organización B: todo rechazado y no visible', async () => {
    const filename = `test_orgB_target_${randomUUID()}.txt`;
    const pathB = `${SEED_DATA.ORG_INM_ID}/${filename}`;
    const insertPathB = `${SEED_DATA.ORG_INM_ID}/test_orgA_insert_${randomUUID()}.txt`;

    // Setup: Admin B crea un objeto real
    await uploadFile(adminBInm, pathB);
    pathsToCleanupB.push(pathB);

    // Admin A no puede ver el objeto real de B
    const listResult = await listFiles(adminALegal, SEED_DATA.ORG_INM_ID);
    expectObjectNotVisible(listResult, filename);

    // INSERT en ruta B rechazado
    expect((await uploadFile(adminALegal, insertPathB)).error).not.toBeNull();

    // UPDATE y DELETE de objeto real B rechazado
    expect((await updateFile(adminALegal, pathB)).error).not.toBeNull();
    expect((await deleteFile(adminALegal, pathB)).error).not.toBeNull();

    // Verificamos persistencia por el legitimo Admin B
    const adminBList = await listFiles(adminBInm, SEED_DATA.ORG_INM_ID);
    expect(adminBList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('6. Perfil inactive: objeto no visible, todo rechazado', async () => {
    const filename = `test_inactive_target_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_inactive_insert_${randomUUID()}.txt`;

    // Setup
    await uploadFile(adminALegal, path);
    pathsToCleanupA.push(path);

    const listResult = await listFiles(inactiveALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    expect((await uploadFile(inactiveALegal, insertPath)).error).not.toBeNull();
    expect((await updateFile(inactiveALegal, path)).error).not.toBeNull();
    expect((await deleteFile(inactiveALegal, path)).error).not.toBeNull();

    // Persistencia
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('7. Anon: objeto no visible, todo rechazado', async () => {
    const filename = `test_anon_target_${randomUUID()}.txt`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_anon_insert_${randomUUID()}.txt`;

    // Setup
    await uploadFile(adminALegal, path);
    pathsToCleanupA.push(path);

    const listResult = await listFiles(anonClient, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    expect((await uploadFile(anonClient, insertPath)).error).not.toBeNull();
    expect((await updateFile(anonClient, path)).error).not.toBeNull();
    expect((await deleteFile(anonClient, path)).error).not.toBeNull();

    // Persistencia
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });
});
