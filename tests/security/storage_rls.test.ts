import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials for Storage RLS tests.');
}

describe('Storage RLS Policies (documents_*)', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
  let inactiveALegal: any;
  let anonClient: any;

  beforeAll(async () => {
    const login = async (email: string) => {
      const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      return client;
    };

    adminALegal = await login('admin_legal@test.com');
    employeeALegal = await login('employee_legal@test.com');
    auditorALegal = await login('auditor_legal@test.com');
    clientALegal = await login('client_legal_assigned@test.com');
    inactiveALegal = await login('inactive_legal@test.com');
    
    anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  });

  const uploadFile = async (client: any, path: string) => {
    // We upload a tiny text file
    return client.storage.from('documents').upload(path, new Blob(['test content']), { upsert: false });
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

  it('admin de organización A puede SELECT, INSERT, UPDATE y DELETE dentro de A', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_admin_${randomUUID()}.txt`;
    
    // INSERT
    const { error: insertErr } = await uploadFile(adminALegal, path);
    expect(insertErr).toBeNull();

    // SELECT
    const { data: listData, error: listErr } = await listFiles(adminALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();
    expect(listData?.some((f: any) => f.name === path.split('/')[1])).toBe(true);

    // UPDATE
    const { error: updateErr } = await updateFile(adminALegal, path);
    expect(updateErr).toBeNull();

    // DELETE
    const { error: deleteErr } = await deleteFile(adminALegal, path);
    expect(deleteErr).toBeNull();
  });

  it('employee de A puede SELECT, INSERT y UPDATE dentro de A, pero no DELETE', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_employee_${randomUUID()}.txt`;
    
    // INSERT
    const { error: insertErr } = await uploadFile(employeeALegal, path);
    expect(insertErr).toBeNull();

    // SELECT
    const { error: listErr } = await listFiles(employeeALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();

    // UPDATE
    const { error: updateErr } = await updateFile(employeeALegal, path);
    expect(updateErr).toBeNull();

    // DELETE (debe fallar)
    const { error: deleteErr } = await deleteFile(employeeALegal, path);
    expect(deleteErr).not.toBeNull();
  });

  it('auditor de A puede SELECT pero no INSERT, UPDATE ni DELETE', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_auditor_${randomUUID()}.txt`;
    
    // INSERT (falla)
    const { error: insertErr } = await uploadFile(auditorALegal, path);
    expect(insertErr).not.toBeNull();

    // SELECT (pasa, puede listar la org)
    const { error: listErr } = await listFiles(auditorALegal, SEED_DATA.ORG_LEGAL_ID);
    expect(listErr).toBeNull();

    // UPDATE (falla)
    const { error: updateErr } = await updateFile(auditorALegal, path);
    expect(updateErr).not.toBeNull();

    // DELETE (falla)
    const { error: deleteErr } = await deleteFile(auditorALegal, path);
    expect(deleteErr).not.toBeNull();
  });

  it('client de A no puede operar directamente en Storage', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_client_${randomUUID()}.txt`;
    
    expect((await listFiles(clientALegal, SEED_DATA.ORG_LEGAL_ID)).error).not.toBeNull();
    expect((await uploadFile(clientALegal, path)).error).not.toBeNull();
    expect((await updateFile(clientALegal, path)).error).not.toBeNull();
    expect((await deleteFile(clientALegal, path)).error).not.toBeNull();
  });

  it('usuario de A no puede operar sobre una ruta cuyo primer segmento sea la organización B', async () => {
    const pathB = `${SEED_DATA.ORG_INM_ID}/test_cross_${randomUUID()}.txt`;
    
    expect((await listFiles(adminALegal, SEED_DATA.ORG_INM_ID)).error).not.toBeNull();
    expect((await uploadFile(adminALegal, pathB)).error).not.toBeNull();
    expect((await updateFile(adminALegal, pathB)).error).not.toBeNull();
    expect((await deleteFile(adminALegal, pathB)).error).not.toBeNull();
  });

  it('perfil inactive no puede operar', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_inactive_${randomUUID()}.txt`;
    
    expect((await listFiles(inactiveALegal, SEED_DATA.ORG_LEGAL_ID)).error).not.toBeNull();
    expect((await uploadFile(inactiveALegal, path)).error).not.toBeNull();
    expect((await updateFile(inactiveALegal, path)).error).not.toBeNull();
    expect((await deleteFile(inactiveALegal, path)).error).not.toBeNull();
  });

  it('usuario no autenticado no puede operar', async () => {
    const path = `${SEED_DATA.ORG_LEGAL_ID}/test_anon_${randomUUID()}.txt`;
    
    expect((await listFiles(anonClient, SEED_DATA.ORG_LEGAL_ID)).error).not.toBeNull();
    expect((await uploadFile(anonClient, path)).error).not.toBeNull();
    expect((await updateFile(anonClient, path)).error).not.toBeNull();
    expect((await deleteFile(anonClient, path)).error).not.toBeNull();
  });
});
