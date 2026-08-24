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
  const embedding = Array(768).fill(0.01);

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }
    if (supabaseUrl.includes('supabase.co')) {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Detectada URL de Production.');
    }

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

  it('1. Anon Client - Denegación total y RPC', async () => {
    const { data, error } = await anonClient.from('cases').select('*');
    if (error) {
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    } else {
      expect(data).toHaveLength(0);
    }

    // RPC con error de autorización o vacío, no firma inválida
    const { error: rpcErr, data: rpcData } = await anonClient.rpc('match_case_document_chunks', {
      p_case_id: SEED_DATA.CASE_LEGAL_ID,
      p_query_embedding: JSON.stringify(embedding),
      p_match_threshold: 0.5,
      p_match_count: 5
    });
    // Si no da error explícito, debe devolver vacío (0 rows)
    if (!rpcErr) {
      expect(rpcData).toHaveLength(0);
    } else {
      expect(rpcErr).not.toBeNull();
    }
  });

  it('2. Inactive Client - Denegación total', async () => {
    const { data } = await inactiveALegal.from('cases').select('*');
    expect(data?.length).toBe(0);

    const { error: rpcErr, data: rpcData } = await inactiveALegal.rpc('match_case_document_chunks', {
      p_case_id: SEED_DATA.CASE_LEGAL_ID,
      p_query_embedding: JSON.stringify(embedding),
      p_match_threshold: 0.5,
      p_match_count: 5
    });
    if (!rpcErr) {
      expect(rpcData).toHaveLength(0);
    } else {
      expect(rpcErr).not.toBeNull();
    }

    // Update RLS check
    const { data: updateData } = await inactiveALegal.from('cases').update({ title: 'Hacked' }).eq('id', SEED_DATA.CASE_LEGAL_ID).select();
    expect(updateData?.length).toBe(0); // 0 filas modificadas
    const { data: verifyOrig } = await serviceClient.from('cases').select('title').eq('id', SEED_DATA.CASE_LEGAL_ID).single();
    expect(verifyOrig?.title).not.toBe('Hacked');
  });

  it('3. Auditor - Read-Only y Denial de mutación', async () => {
    const { data, error } = await auditorALegal.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);

    // Write deny
    const { data: updateData } = await auditorALegal.from('cases').update({ title: 'Hacked' }).eq('id', SEED_DATA.CASE_LEGAL_ID).select();
    expect(updateData?.length).toBe(0); // 0 filas modificadas

    // Verificar estado original
    const { data: verifyOrig } = await serviceClient.from('cases').select('title').eq('id', SEED_DATA.CASE_LEGAL_ID).single();
    expect(verifyOrig?.title).not.toBe('Hacked');
  });

  it('4. Client - Asignado vs No Asignado', async () => {
    const { data: assignedData } = await clientALegal.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(assignedData?.length).toBe(1);

    const { data: unassignedData } = await clientAUnassigned.from('cases').select('id').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(unassignedData?.length).toBe(0);
  });

  it('5. Org A -> Org B (Aislamiento Multi-Tenant)', async () => {
    const { data: readB } = await adminBInm.from('cases').select('*').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(readB?.length).toBe(0);

    const { data: updateData } = await adminBInm.from('cases').update({ title: 'Hacked B' }).eq('id', SEED_DATA.CASE_LEGAL_ID).select();
    expect(updateData?.length).toBe(0);
    const { data: verifyOrig } = await serviceClient.from('cases').select('title').eq('id', SEED_DATA.CASE_LEGAL_ID).single();
    expect(verifyOrig?.title).not.toBe('Hacked B');
  });

  it('6. RPC match_case_document_chunks autorizado y denegado cruzado', async () => {
    // Admin A autorizado (debe retornar data o vacío, sin error de permisos o firma)
    const { error: rpcA, data: dataA } = await adminALegal.rpc('match_case_document_chunks', {
      p_case_id: SEED_DATA.CASE_LEGAL_ID,
      p_query_embedding: JSON.stringify(embedding),
      p_match_threshold: 0.5,
      p_match_count: 5
    });
    expect(rpcA).toBeNull(); // No error de firma ni dimensión

    // Admin B denegado (aislamiento)
    const { error: rpcB, data: dataB } = await adminBInm.rpc('match_case_document_chunks', {
      p_case_id: SEED_DATA.CASE_LEGAL_ID,
      p_query_embedding: JSON.stringify(embedding),
      p_match_threshold: 0.5,
      p_match_count: 5
    });
    if (!rpcB) {
      expect(dataB).toHaveLength(0); // Resultado vacío autorizado por el signature, pero denegado lógicamente por RLS
    }
  });

  it('7. Storage Cross-Tenant y Write/Delete', async () => {
    const bucket = 'documents';
    const filePathA = `${SEED_DATA.ORG_LEGAL_ID}/${SEED_DATA.CASE_LEGAL_ID}/test_file.pdf`;

    // Admin A uploads
    await adminALegal.storage.from(bucket).remove([filePathA]); // prep
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const { error: upA } = await adminALegal.storage.from(bucket).upload(filePathA, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });
    expect(upA).toBeNull();

    // Admin B tries to download
    const { error: downB } = await adminBInm.storage.from(bucket).download(filePathA);
    expect(downB).not.toBeNull();

    // Admin B tries to delete
    const { data: removeBData, error: removeBErr } = await adminBInm.storage.from(bucket).remove([filePathA]);
    // Verificamos que no se eliminó (generalmente remove devuelve vacío sin error si no pudo borrar, o da error)
    if (removeBErr) {
      expect(removeBErr).not.toBeNull();
    } else {
      expect(removeBData).toHaveLength(0); // Supabase sometimes returns empty array for failed deletes due to RLS
    }

    const { data: verifyA } = await serviceClient.storage.from(bucket).download(filePathA);
    expect(verifyA).not.toBeNull(); // fila no eliminada (objeto no eliminado)

    // Cleanup A
    const { data: cleanupData, error: cleanupErr } = await serviceClient.storage.from(bucket).remove([filePathA]);
    expect(cleanupErr).toBeNull();
    expect(cleanupData?.length).toBeGreaterThan(0);
  });

  it('8. Agenda UPDATE / DELETE - Check RLS Select', async () => {
    const agendaId = randomUUID();

    // Employee A creates
    await employeeALegal.from('agenda_plazos').insert({
      id: agendaId,
      organization_id: SEED_DATA.ORG_LEGAL_ID,
      case_id: SEED_DATA.CASE_LEGAL_ID,
      titulo: 'Test Agenda Update',
      fecha: '2028-01-01',
      categoria: 'turno'
    });

    // Auditor cannot update
    const { data: errUpdateAuditor } = await auditorALegal.from('agenda_plazos').update({ titulo: 'Hacked' }).eq('id', agendaId).select();
    expect(errUpdateAuditor?.length).toBe(0);
    const { data: orig } = await serviceClient.from('agenda_plazos').select('titulo').eq('id', agendaId).single();
    expect(orig?.titulo).toBe('Test Agenda Update');

    // Admin B cannot delete
    const { data: errDeleteAdminB } = await adminBInm.from('agenda_plazos').delete().eq('id', agendaId).select();
    expect(errDeleteAdminB?.length).toBe(0);

    // Verificamos que no se eliminó
    const { data: verifyEx } = await serviceClient.from('agenda_plazos').select('*').eq('id', agendaId);
    expect(verifyEx?.length).toBe(1);

    // Cleanup via serviceClient
    await serviceClient.from('agenda_plazos').delete().eq('id', agendaId);
  });

  it('9. Idempotencia: 10 inserciones concurrentes de Documents', async () => {
    const fileHash = 'hash_idempotencia_' + randomUUID();
    const caseId = SEED_DATA.CASE_LEGAL_ID;

    const inserts = Array.from({ length: 10 }).map((_, i) => {
      return adminALegal.from('documents').insert({
        id: randomUUID(),
        organization_id: SEED_DATA.ORG_LEGAL_ID,
        case_id: caseId,
        file_name: `doc_${i}.pdf`,
        file_path: `${SEED_DATA.ORG_LEGAL_ID}/${caseId}/doc_${i}.pdf`,
        file_mime_type: 'application/pdf',
        file_size: 1000,
        file_hash: fileHash,
        uploaded_by: SEED_DATA.ADMIN_LEGAL_ID
      });
    });

    const results = await Promise.allSettled(inserts);

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

    // Verificar exactamente 1 fila persistida
    const { count } = await serviceClient.from('documents').select('*', { count: 'exact', head: true }).eq('file_hash', fileHash);
    expect(count).toBe(1);

    // Cleanup
    await serviceClient.from('documents').delete().eq('file_hash', fileHash);
  });

  it('10. Grants (No EXECUTE on all routines)', async () => {
    const { error } = await anonClient.rpc('pg_sleep', { seconds: 1 });
    expect(error).not.toBeNull();
  });
});
