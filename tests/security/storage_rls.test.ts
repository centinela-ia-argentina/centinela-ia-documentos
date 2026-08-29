import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials for Storage RLS tests.');
}

const createPdfBlob = (content = 'Centinela IA Storage RLS test') =>
  new Blob(
    [
      '%PDF-1.4\n',
      '1 0 obj\n',
      '<< /Type /Catalog >>\n',
      'endobj\n',
      `% ${content}\n`,
      '%%EOF\n',
    ],
    { type: 'application/pdf' }
  );

const expectObjectNotVisible = (result: { data: any[] | null, error: any }, expectedFileName: string) => {
  if (result.error) {
    return;
  }
  const found = result.data?.some((f: any) => f.name === expectedFileName);
  expect(found).not.toBe(true);
};

const expectObjectContent = async (
  adminClient: any,
  path: string,
  expectedContent: string,
  forbiddenContent?: string
) => {
  const { data, error } = await adminClient.storage.from('documents').download(path);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  
  const text = await data!.text();
  expect(text).toContain(expectedContent);
  if (forbiddenContent) {
    expect(text).not.toContain(forbiddenContent);
  }
};

describe('Storage RLS Policies (documents_*) con objetos reales PDF', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
  let inactiveALegal: any;
  let adminBInm: any;
  let anonClient: any;

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
    if (pathsToCleanupA.length > 0) {
      const resA = await adminALegal.storage.from('documents').remove(pathsToCleanupA);
      if (resA.error) throw new Error(`Cleanup failed for Org A: ${resA.error.message}`);
    }
    if (pathsToCleanupB.length > 0) {
      const resB = await adminBInm.storage.from('documents').remove(pathsToCleanupB);
      if (resB.error) throw new Error(`Cleanup failed for Org B: ${resB.error.message}`);
    }
  });

  const uploadFile = async (client: any, path: string, content = 'Centinela IA Storage RLS test') => {
    return client.storage
      .from('documents')
      .upload(path, createPdfBlob(content), {
        contentType: 'application/pdf',
        upsert: false,
      });
  };

  const updateFile = async (client: any, path: string, content = 'Centinela IA Storage RLS updated test') => {
    return client.storage
      .from('documents')
      .update(path, createPdfBlob(content), {
        contentType: 'application/pdf',
        upsert: true,
      });
  };

  const deleteFile = async (client: any, path: string) => {
    return client.storage.from('documents').remove([path]);
  };

  const listFiles = async (client: any, path: string) => {
    return client.storage.from('documents').list(path);
  };

  it('1. Admin A: INSERT PDF permitido, SELECT, UPDATE y DELETE', async () => {
    const filename = `test_admin_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    pathsToCleanupA.push(path); 
    
    // INSERT
    const insertRes = await uploadFile(adminALegal, path, 'original-admin-a');
    expect(insertRes.error).toBeNull();
    expect(insertRes.data).not.toBeNull();

    // SELECT
    const listData = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listData.error).toBeNull();
    expect(listData.data?.some((f: any) => f.name === filename)).toBe(true);

    // UPDATE
    const updateRes = await updateFile(adminALegal, path, 'updated-admin-a');
    expect(updateRes.error).toBeNull();
    await expectObjectContent(adminALegal, path, 'updated-admin-a', 'original-admin-a');

    // DELETE
    const deleteRes = await deleteFile(adminALegal, path);
    expect(deleteRes.error).toBeNull();
    const listAfterDelete = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listAfterDelete, filename);
  });

  it('2. Employee A: INSERT, SELECT, UPDATE permitidos. DELETE no afecta el objeto', async () => {
    const filename = `test_employee_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    pathsToCleanupA.push(path);
    
    // INSERT
    const insertRes = await uploadFile(employeeALegal, path, 'original-employee-a');
    expect(insertRes.error).toBeNull();
    expect(insertRes.data).not.toBeNull();

    // SELECT
    const listRes = await listFiles(employeeALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listRes.error).toBeNull();
    expect(listRes.data?.some((f: any) => f.name === filename)).toBe(true);

    // UPDATE
    const updateRes = await updateFile(employeeALegal, path, 'updated-employee-a');
    expect(updateRes.error).toBeNull();
    await expectObjectContent(adminALegal, path, 'updated-employee-a');

    // DELETE
    await deleteFile(employeeALegal, path);

    // PERSISTENCE CHECK
    const adminList = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminList.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('3. Auditor A: SELECT objeto real. INSERT, UPDATE y DELETE negativos', async () => {
    const filename = `test_auditor_target_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_auditor_insert_${randomUUID()}.pdf`;
    pathsToCleanupA.push(path, insertPath);

    const setupResult = await uploadFile(adminALegal, path, 'original-auditor-a');
    expect(setupResult.error).toBeNull();
    expect(setupResult.data).not.toBeNull();

    // SELECT
    const listRes = await listFiles(auditorALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listRes.error).toBeNull();
    expect(listRes.data?.some((f: any) => f.name === filename)).toBe(true);

    // INSERT negativo
    await uploadFile(auditorALegal, insertPath);
    const adminListAfterInsert = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(adminListAfterInsert, insertPath.split('/')[1]);

    // UPDATE negativo
    await updateFile(auditorALegal, path, 'forbidden-update-auditor');
    await expectObjectContent(adminALegal, path, 'original-auditor-a', 'forbidden-update-auditor');

    // DELETE negativo
    await deleteFile(auditorALegal, path);
    const adminListAfterDelete = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminListAfterDelete.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('4. Client A: no observa, no inserta, no muta, no elimina', async () => {
    const filename = `test_client_target_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_client_insert_${randomUUID()}.pdf`;
    pathsToCleanupA.push(path, insertPath);

    const setupResult = await uploadFile(adminALegal, path, 'original-client-a');
    expect(setupResult.error).toBeNull();
    expect(setupResult.data).not.toBeNull();

    // SELECT legitimo primero
    const checkVisible = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(checkVisible.data?.some((f: any) => f.name === filename)).toBe(true);

    // SELECT restringido
    const listResult = await listFiles(clientALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    // INSERT
    await uploadFile(clientALegal, insertPath);
    const adminListAfterInsert = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(adminListAfterInsert, insertPath.split('/')[1]);

    // UPDATE
    await updateFile(clientALegal, path, 'forbidden-update-client');
    await expectObjectContent(adminALegal, path, 'original-client-a', 'forbidden-update-client');

    // DELETE
    await deleteFile(clientALegal, path);
    const adminListAfterDelete = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminListAfterDelete.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('5. Admin A contra B: rechazo cruzado en todas las operaciones', async () => {
    const filename = `test_orgB_target_${randomUUID()}.pdf`;
    const pathB = `${SEED_DATA.ORG_INM_ID}/${filename}`;
    const insertPathB = `${SEED_DATA.ORG_INM_ID}/test_orgA_insert_${randomUUID()}.pdf`;
    pathsToCleanupB.push(pathB, insertPathB);

    const setupResult = await uploadFile(adminBInm, pathB, 'original-org-b');
    expect(setupResult.error).toBeNull();
    expect(setupResult.data).not.toBeNull();

    // SELECT legitimo
    const checkVisible = await listFiles(adminBInm, SEED_DATA.ORG_INM_ID);
    expect(checkVisible.data?.some((f: any) => f.name === filename)).toBe(true);

    // SELECT cruzado
    const listResult = await listFiles(adminALegal, SEED_DATA.ORG_INM_ID);
    expectObjectNotVisible(listResult, filename);

    // INSERT cruzado
    await uploadFile(adminALegal, insertPathB);
    const adminBListAfterInsert = await listFiles(adminBInm, SEED_DATA.ORG_INM_ID);
    expectObjectNotVisible(adminBListAfterInsert, insertPathB.split('/')[1]);

    // UPDATE cruzado
    await updateFile(adminALegal, pathB, 'forbidden-update-cross');
    await expectObjectContent(adminBInm, pathB, 'original-org-b', 'forbidden-update-cross');

    // DELETE cruzado
    await deleteFile(adminALegal, pathB);
    const adminBListAfterDelete = await listFiles(adminBInm, SEED_DATA.ORG_INM_ID);
    expect(adminBListAfterDelete.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('6. Inactive: no observa, no muta, no elimina', async () => {
    const filename = `test_inactive_target_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_inactive_insert_${randomUUID()}.pdf`;
    pathsToCleanupA.push(path, insertPath);

    const setupResult = await uploadFile(adminALegal, path, 'original-inactive');
    expect(setupResult.error).toBeNull();
    expect(setupResult.data).not.toBeNull();

    const checkVisible = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(checkVisible.data?.some((f: any) => f.name === filename)).toBe(true);

    const listResult = await listFiles(inactiveALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    await uploadFile(inactiveALegal, insertPath);
    const adminListAfterInsert = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(adminListAfterInsert, insertPath.split('/')[1]);

    await updateFile(inactiveALegal, path, 'forbidden-update-inactive');
    await expectObjectContent(adminALegal, path, 'original-inactive', 'forbidden-update-inactive');

    await deleteFile(inactiveALegal, path);
    const adminListAfterDelete = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminListAfterDelete.data?.some((f: any) => f.name === filename)).toBe(true);
  });

  it('7. Anon: no observa, no muta, no elimina', async () => {
    const filename = `test_anon_target_${randomUUID()}.pdf`;
    const path = `${SEED_DATA.ORG_LEGAL_ID}/${filename}`;
    const insertPath = `${SEED_DATA.ORG_LEGAL_ID}/test_anon_insert_${randomUUID()}.pdf`;
    pathsToCleanupA.push(path, insertPath);

    const setupResult = await uploadFile(adminALegal, path, 'original-anon');
    expect(setupResult.error).toBeNull();
    expect(setupResult.data).not.toBeNull();

    const checkVisible = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(checkVisible.data?.some((f: any) => f.name === filename)).toBe(true);

    const listResult = await listFiles(anonClient, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(listResult, filename);

    await uploadFile(anonClient, insertPath);
    const adminListAfterInsert = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expectObjectNotVisible(adminListAfterInsert, insertPath.split('/')[1]);

    await updateFile(anonClient, path, 'forbidden-update-anon');
    await expectObjectContent(adminALegal, path, 'original-anon', 'forbidden-update-anon');

    await deleteFile(anonClient, path);
    const adminListAfterDelete = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(adminListAfterDelete.data?.some((f: any) => f.name === filename)).toBe(true);
  });
});
