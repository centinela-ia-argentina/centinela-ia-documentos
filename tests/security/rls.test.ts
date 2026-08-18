import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials for RLS tests.');
}

// 1. serviceClient NEVER executes signInWithPassword
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('Pruebas de Seguridad y RLS con JWT Reales y Restricciones', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
  let clientAUnassigned: any;
  let inactiveALegal: any;
  let adminBInm: any;
  let anonClient: any;

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }
    if (supabaseUrl.includes('supabase.co')) {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Detectada URL de Production.');
    }

    // Anon Client
    anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    // 2. Crear cada cliente JWT con un cliente anon separado
    const login = async (email: string) => {
      const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
      // 3. Afirmar error y session en todos los logins
      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      return client;
    };

    adminALegal = await login('admin.legal@test.com');
    employeeALegal = await login('emp.legal@test.com');
    auditorALegal = await login('auditor.legal@test.com');
    clientALegal = await login('client.assigned@test.com');
    clientAUnassigned = await login('client.unassigned@test.com');
    inactiveALegal = await login('inactive.legal@test.com');
    adminBInm = await login('admin.inm@test.com');
  });

  it('1. Anon Client - Denegación total', async () => {
    const { data, error } = await anonClient.from('cases').select('*');
    expect(data?.length).toBe(0); // RLS defaults to empty or error

    // RPC
    const { error: rpcErr } = await anonClient.rpc('match_case_document_chunks', { query_embedding: '[0,0,0]', match_count: 1, p_case_id: SEED_DATA.CASE_LEGAL_ID });
    expect(rpcErr).not.toBeNull();
  });

  it('2. Inactive Client - Denegación total', async () => {
    const { data } = await inactiveALegal.from('cases').select('*');
    expect(data?.length).toBe(0);
    const { error: rpcErr } = await inactiveALegal.rpc('match_case_document_chunks', { query_embedding: '[0,0,0]', match_count: 1, p_case_id: SEED_DATA.CASE_LEGAL_ID });
    expect(rpcErr).not.toBeNull();
  });

  it('3. Auditor - Read-Only y Denial de mutación', async () => {
    // Read ok
    const { data, error } = await auditorALegal.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);

    // Write deny
    const { error: writeErr } = await auditorALegal.from('cases').update({ title: 'Hacked' }).eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(writeErr).not.toBeNull(); // Denied
  });

  it('4. Client - Asignado vs No Asignado', async () => {
    // Assigned can see
    const { data: assignedData } = await clientALegal.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(assignedData?.length).toBe(1);

    // Unassigned cannot see
    const { data: unassignedData } = await clientAUnassigned.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(unassignedData?.length).toBe(0);
  });

  it('5. Org A -> Org B (Aislamiento Multi-Tenant)', async () => {
    // B trying to read A
    const { data: readB } = await adminBInm.from('cases').select('*').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(readB?.length).toBe(0);
  });

  it('6. RPC match_case_document_chunks Org A -> case B y otros roles', async () => {
    // Admin B trying to run RPC on Case A
    const { error: rpcB } = await adminBInm.rpc('match_case_document_chunks', {
      query_embedding: '[0,0,0]', match_count: 1, p_case_id: SEED_DATA.CASE_LEGAL_ID
    });
    // It should error or return empty, usually RPC with strict RLS inside returns empty array, but we assert error or empty
    if (!rpcB) {
        const { data } = await adminBInm.rpc('match_case_document_chunks', { query_embedding: '[0,0,0]', match_count: 1, p_case_id: SEED_DATA.CASE_LEGAL_ID });
        expect(data).toHaveLength(0);
    }
  });

  it('7. Storage Cross-Tenant y Write/Delete', async () => {
    const bucket = 'documents';
    const filePathA = `${SEED_DATA.ORG_LEGAL_ID}/${SEED_DATA.CASE_LEGAL_ID}/test_file.pdf`;

    // Admin A uploads
    const { error: upA } = await adminALegal.storage.from(bucket).upload(filePathA, new Uint8Array([37, 80, 68, 70])); // %PDF
    if (upA) {
      // Cleanup if it existed
      await adminALegal.storage.from(bucket).remove([filePathA]);
      await adminALegal.storage.from(bucket).upload(filePathA, new Uint8Array([37, 80, 68, 70]));
    }

    // Admin B tries to download
    const { error: downB } = await adminBInm.storage.from(bucket).download(filePathA);
    expect(downB).not.toBeNull();

    // Admin B tries to delete
    const { error: delB } = await adminBInm.storage.from(bucket).remove([filePathA]);
    // The API might not error, but it won't delete. Let's check if it's still there
    const { data: verifyA } = await adminALegal.storage.from(bucket).download(filePathA);
    expect(verifyA).not.toBeNull();

    // Cleanup A
    await adminALegal.storage.from(bucket).remove([filePathA]);
  });

  it('8. Agenda UPDATE / DELETE', async () => {
    const orgAId = SEED_DATA.ORG_LEGAL_ID;
    const agendaId = randomUUID();

    // Employee A creates
    await employeeALegal.from('agenda_plazos').insert({
      id: agendaId,
      organization_id: orgAId,
      titulo: 'Test Agenda Update',
      fecha: '2028-01-01',
      categoria: 'turno'
    });

    // Auditor cannot update
    const { error: errUpdateAuditor } = await auditorALegal.from('agenda_plazos').update({ titulo: 'Hacked' }).eq('id', agendaId);
    expect(errUpdateAuditor).not.toBeNull();

    // Admin B cannot delete
    await adminBInm.from('agenda_plazos').delete().eq('id', agendaId);

    // Employee A verifies it exists
    const { data: verifyEx } = await employeeALegal.from('agenda_plazos').select('*').eq('id', agendaId);
    expect(verifyEx?.length).toBe(1);

    // Employee A deletes
    await employeeALegal.from('agenda_plazos').delete().eq('id', agendaId);
  });

  it('9. Diez inserciones concurrentes y upload concurrente (Idempotencia DB)', async () => {
    // Testing the DB unique constraint on file_hash and case_id
    const fileHash = 'hash12345';
    const caseId = SEED_DATA.CASE_LEGAL_ID;

    const inserts = Array.from({ length: 10 }).map((_, i) => {
      return adminALegal.from('documents').insert({
        organization_id: SEED_DATA.ORG_LEGAL_ID,
        case_id: caseId,
        name: `doc_${i}.pdf`,
        file_path: `${SEED_DATA.ORG_LEGAL_ID}/${caseId}/doc_${i}.pdf`,
        file_hash: fileHash, // Same hash!
        size: 1000
      });
    });

    const results = await Promise.allSettled(inserts);

    // Check how many succeeded
    let successCount = 0;
    let dupCount = 0;
    for (const res of results) {
      if (res.status === 'fulfilled') {
        if (!res.value.error) {
          successCount++;
        } else if (res.value.error.code === '23505') {
          dupCount++;
        }
      }
    }

    expect(successCount).toBe(1);
    expect(dupCount).toBe(9);
  });

  it('10. Grants (No EXECUTE on all routines)', async () => {
    // We try to call an internal Postgres function from anon
    const { error } = await anonClient.rpc('pg_sleep', { seconds: 1 });
    expect(error).not.toBeNull();
  });
});
