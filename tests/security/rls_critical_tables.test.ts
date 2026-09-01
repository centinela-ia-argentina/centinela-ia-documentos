import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
  throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
}

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Faltan credenciales de Supabase locales');
}

const host = new URL(supabaseUrl).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error('BLOCKED_BY_ENVIRONMENT: Las pruebas solo deben ejecutarse localmente');
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function login(email: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  expect(data.user).not.toBeNull();
  return client;
}

let adminA: SupabaseClient;
let empA: SupabaseClient;
let auditorA: SupabaseClient;
let clientAsignadoA: SupabaseClient;
let clientNoAsignadoA: SupabaseClient;
let inactivoA: SupabaseClient;
let adminB: SupabaseClient;
let adminC: SupabaseClient;
let anon: SupabaseClient;

beforeAll(async () => {
  adminA = await login('admin.legal@test.com');
  empA = await login('emp.legal@test.com');
  auditorA = await login('auditor.legal@test.com');
  clientAsignadoA = await login('client.assigned@test.com');
  clientNoAsignadoA = await login('client.unassigned@test.com');
  inactivoA = await login('inactive.legal@test.com');
  adminB = await login('admin.inm@test.com');
  adminC = await login('admin.esc@test.com');

  anon = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

const ORG_A = SEED_DATA.ORG_LEGAL_ID;
const ORG_B = SEED_DATA.ORG_INM_ID;
const ORG_C = SEED_DATA.ORG_ESC_ID;
const CASE_A = SEED_DATA.CASE_LEGAL_ID;
const CASE_B = SEED_DATA.CASE_INM_ID;
const DOC_A = SEED_DATA.DOC_LEGAL_ID;

// HELPERS DE FIXTURES (OBLIGATORIOS)

async function insertFixtureOrFail(table: string, payload: any) {
  const { error } = await serviceClient.from(table).insert(payload);
  expect(error).toBeNull();
  const { data, error: vErr } = await serviceClient.from(table).select('*').eq('id', payload.id).single();
  expect(vErr).toBeNull();
  expect(data).not.toBeNull();
}

async function deleteFixtureOrFail(table: string, id: string) {
  const { error } = await serviceClient.from(table).delete().eq('id', id);
  expect(error).toBeNull();
  await assertFixtureAbsent(table, id);
}

async function assertFixtureAbsent(table: string, id: string) {
  const { data, error } = await serviceClient.from(table).select('*').eq('id', id);
  expect(error).toBeNull();
  expect(data === null || (data as any[]).length === 0).toBe(true);
}

// HELPERS DE PRUEBAS

async function expectRlsDeniedInsert(table: string, client: SupabaseClient, payload: any) {
  const { data, error } = await client.from(table).insert(payload).select();
  if (!error) throw new Error(`Esperaba error de RLS en ${table} pero la inserción fue exitosa.`);
  if (error.code !== '42501') {
    throw new Error(`Error inesperado en inserción RLS denegada: ${error.code} - ${error.message}. Se esperaba 42501.`);
  }
  expect(data === null || (data as any[]).length === 0).toBe(true);
  await assertFixtureAbsent(table, payload.id);
}

async function expectIntegrityRejectedInsert(table: string, client: SupabaseClient, payload: any) {
  const { data, error } = await client.from(table).insert(payload).select();
  if (!error) throw new Error(`Esperaba error de FK en ${table} pero la inserción fue exitosa.`);
  if (error.code !== '23503') {
    throw new Error(`Error inesperado en integridad cruzada: ${error.code} - ${error.message}. Se esperaba 23503.`);
  }
  expect(data === null || (data as any[]).length === 0).toBe(true);
  await assertFixtureAbsent(table, payload.id);
}

async function expectAllowedInsert(table: string, client: SupabaseClient, payload: any) {
  const { error } = await client.from(table).insert(payload);
  expect(error).toBeNull();

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', payload.id);
  expect(vErr).toBeNull();
  expect(verify?.length).toBe(1);
}

async function expectDeniedUpdate(table: string, client: SupabaseClient, id: string, payload: any, originalObj: any) {
  const { data, error } = await client.from(table).update(payload).eq('id', id).select();
  if (error && error.code !== '42501') {
    throw new Error(`Error inesperado en UPDATE RLS: ${error.code} - ${error.message}`);
  }
  expect(data === null || (data as any[]).length === 0).toBe(true);

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', id).single();
  expect(vErr).toBeNull();
  const keyToVerify = Object.keys(payload)[0];
  expect(verify[keyToVerify]).toEqual(originalObj[keyToVerify]);
}

async function expectAllowedUpdate(table: string, client: SupabaseClient, id: string, payload: any) {
  const { error } = await client.from(table).update(payload).eq('id', id);
  expect(error).toBeNull();

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', id).single();
  expect(vErr).toBeNull();
  const keyToVerify = Object.keys(payload)[0];
  expect(verify[keyToVerify]).toEqual(payload[keyToVerify]);
}

async function expectDeniedDelete(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).delete().eq('id', id).select();
  if (error && error.code !== '42501') {
    throw new Error(`Error inesperado en DELETE RLS: ${error.code} - ${error.message}`);
  }
  expect(data === null || (data as any[]).length === 0).toBe(true);

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', id);
  expect(vErr).toBeNull();
  expect(verify?.length).toBe(1);
}

async function expectAllowedDelete(table: string, client: SupabaseClient, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  expect(error).toBeNull();
  await assertFixtureAbsent(table, id);
}

async function expectDeniedSelect(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).select('*').eq('id', id);
  if (error && error.code !== '42501') {
    throw new Error(`Error inesperado en SELECT RLS: ${error.code} - ${error.message}`);
  }
  expect(data === null || (data as any[]).length === 0).toBe(true);
}

async function expectAllowedSelect(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).select('*').eq('id', id);
  expect(error).toBeNull();
  expect(data?.length).toBe(1);
}

// ==========================================
// 1. documents
// ==========================================
describe('RLS: documents', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    file_name: 'test.pdf',
    file_path: 'test.pdf',
    file_size: 100,
    file_mime_type: 'application/pdf',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('documents', client, payload);
      } finally {
        await deleteFixtureOrFail('documents', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB, adminC]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('documents', client, payload);
      } finally {
        await assertFixtureAbsent('documents', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('documents', payload);
    try {
      for (const client of [adminA, empA, auditorA, clientAsignadoA]) {
        await expectAllowedSelect('documents', client, id);
      }
    } finally {
      await deleteFixtureOrFail('documents', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('documents', payload);
    try {
      for (const client of [clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
        await expectDeniedSelect('documents', client, id);
      }
    } finally {
      await deleteFixtureOrFail('documents', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('documents', payload);
      try {
        await expectAllowedUpdate('documents', client, id, { file_name: 'updated.pdf' });
      } finally {
        await deleteFixtureOrFail('documents', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('documents', payload);
      try {
        await expectDeniedUpdate('documents', client, id, { file_name: 'updated.pdf' }, payload);
      } finally {
        await deleteFixtureOrFail('documents', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('documents', payload);
      try {
        await expectAllowedDelete('documents', client, id);
      } finally {
        await assertFixtureAbsent('documents', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('documents', payload);
      try {
        await expectDeniedDelete('documents', client, id);
      } finally {
        await deleteFixtureOrFail('documents', id);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO: positivo org A', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    try {
      await expectAllowedInsert('documents', adminA, payload);
    } finally {
      await deleteFixtureOrFail('documents', id);
    }
  });

  it('RELACIÓN PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectIntegrityRejectedInsert('documents', adminA, payload);
    } finally {
      await assertFixtureAbsent('documents', id);
    }
  });
});

// ==========================================
// 2. ai_outputs
// ==========================================
describe('RLS: ai_outputs', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    document_id: DOC_A,
    output_type: 'classification',
    content: { test: 1 },
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('ai_outputs', client, payload);
      } finally {
        await deleteFixtureOrFail('ai_outputs', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB, adminC]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('ai_outputs', client, payload);
      } finally {
        await assertFixtureAbsent('ai_outputs', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('ai_outputs', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('ai_outputs', client, id);
      }
    } finally {
      await deleteFixtureOrFail('ai_outputs', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('ai_outputs', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
        await expectDeniedSelect('ai_outputs', client, id);
      }
    } finally {
      await deleteFixtureOrFail('ai_outputs', id);
    }
  });

  it('UPDATE - denegados para todos', async () => {
    for (const client of [adminA, empA, auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('ai_outputs', payload);
      try {
        await expectDeniedUpdate('ai_outputs', client, id, { output_type: 'classification' }, payload);
      } finally {
        await deleteFixtureOrFail('ai_outputs', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('ai_outputs', payload);
      try {
        await expectAllowedDelete('ai_outputs', client, id);
      } finally {
        await assertFixtureAbsent('ai_outputs', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [empA, auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('ai_outputs', payload);
      try {
        await expectDeniedDelete('ai_outputs', client, id);
      } finally {
        await deleteFixtureOrFail('ai_outputs', id);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO (case): negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectIntegrityRejectedInsert('ai_outputs', adminA, payload);
    } finally {
      await assertFixtureAbsent('ai_outputs', id);
    }
  });

  it('RELACIÓN PADRE-HIJO: ai_outputs -> documents (positivo)', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    try {
      await expectAllowedInsert('ai_outputs', adminA, payload);
    } finally {
      await deleteFixtureOrFail('ai_outputs', id);
    }
  });

  it('RELACIÓN PADRE-HIJO: ai_outputs -> documents (negativo cruzado Org A apunta a Document Org B)', async () => {
    const docB_id = crypto.randomUUID();
    const aiId = crypto.randomUUID();
    await insertFixtureOrFail('documents', {
        id: docB_id,
        organization_id: ORG_B,
        case_id: CASE_B,
        file_name: 'b.pdf', file_path: 'b.pdf', file_size: 10, file_mime_type: 'application/pdf'
    });

    try {
        const payload = { ...getPayload(aiId), document_id: docB_id };
        await expectIntegrityRejectedInsert('ai_outputs', adminA, payload);
    } finally {
        await deleteFixtureOrFail('ai_outputs', aiId);
        await deleteFixtureOrFail('documents', docB_id);
    }
  });
});

// ==========================================
// 3. agent_messages
// ==========================================
describe('RLS: agent_messages', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    role: 'user',
    content: 'test',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('agent_messages', client, payload);
      } finally {
        await deleteFixtureOrFail('agent_messages', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB, adminC]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('agent_messages', client, payload);
      } finally {
        await assertFixtureAbsent('agent_messages', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('agent_messages', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('agent_messages', client, id);
      }
    } finally {
      await deleteFixtureOrFail('agent_messages', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('agent_messages', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
        await expectDeniedSelect('agent_messages', client, id);
      }
    } finally {
      await deleteFixtureOrFail('agent_messages', id);
    }
  });

  it('UPDATE - denegados para todos', async () => {
    for (const client of [adminA, empA, auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('agent_messages', payload);
      try {
        await expectDeniedUpdate('agent_messages', client, id, { content: 'updated' }, payload);
      } finally {
        await deleteFixtureOrFail('agent_messages', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('agent_messages', payload);
      try {
        await expectAllowedDelete('agent_messages', client, id);
      } finally {
        await assertFixtureAbsent('agent_messages', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [empA, auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('agent_messages', payload);
      try {
        await expectDeniedDelete('agent_messages', client, id);
      } finally {
        await deleteFixtureOrFail('agent_messages', id);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectIntegrityRejectedInsert('agent_messages', adminA, payload);
    } finally {
      await assertFixtureAbsent('agent_messages', id);
    }
  });
});

// ==========================================
// 4. case_events
// ==========================================
describe('RLS: case_events', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    event_date: '2028-01-15',
    event_type: 'test_event',
    title: 'test',
    description: 'test',
    created_by: SEED_DATA.ADMIN_LEGAL_ID,
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('case_events', client, payload);
      } finally {
        await deleteFixtureOrFail('case_events', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB, adminC]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('case_events', client, payload);
      } finally {
        await assertFixtureAbsent('case_events', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('case_events', payload);
    try {
      for (const client of [adminA, empA, auditorA, clientAsignadoA]) {
        await expectAllowedSelect('case_events', client, id);
      }
    } finally {
      await deleteFixtureOrFail('case_events', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('case_events', payload);
    try {
      for (const client of [clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
        await expectDeniedSelect('case_events', client, id);
      }
    } finally {
      await deleteFixtureOrFail('case_events', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_events', payload);
      try {
        await expectAllowedUpdate('case_events', client, id, { description: 'updated' });
      } finally {
        await deleteFixtureOrFail('case_events', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_events', payload);
      try {
        await expectDeniedUpdate('case_events', client, id, { description: 'updated' }, payload);
      } finally {
        await deleteFixtureOrFail('case_events', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_events', payload);
      try {
        await expectAllowedDelete('case_events', client, id);
      } finally {
        await assertFixtureAbsent('case_events', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, adminC, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_events', payload);
      try {
        await expectDeniedDelete('case_events', client, id);
      } finally {
        await deleteFixtureOrFail('case_events', id);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectIntegrityRejectedInsert('case_events', adminA, payload);
    } finally {
      await assertFixtureAbsent('case_events', id);
    }
  });
});

// ==========================================
// 5. reports
// ==========================================
describe('RLS: reports', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    report_type: 'test',
    title: 'test',
    content: { key: 'value' },
    created_by: SEED_DATA.ADMIN_LEGAL_ID,
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('reports', client, payload);
      } finally {
        await deleteFixtureOrFail('reports', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('reports', client, payload);
      } finally {
        await assertFixtureAbsent('reports', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('reports', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('reports', client, id);
      }
    } finally {
      await deleteFixtureOrFail('reports', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('reports', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('reports', client, id);
      }
    } finally {
      await deleteFixtureOrFail('reports', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('reports', payload);
      try {
        await expectAllowedUpdate('reports', client, id, { title: 'updated' });
      } finally {
        await deleteFixtureOrFail('reports', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('reports', payload);
      try {
        await expectDeniedUpdate('reports', client, id, { title: 'updated' }, payload);
      } finally {
        await deleteFixtureOrFail('reports', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('reports', payload);
      try {
        await expectAllowedDelete('reports', client, id);
      } finally {
        await assertFixtureAbsent('reports', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('reports', payload);
      try {
        await expectDeniedDelete('reports', client, id);
      } finally {
        await deleteFixtureOrFail('reports', id);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectIntegrityRejectedInsert('reports', adminA, payload);
    } finally {
      await assertFixtureAbsent('reports', id);
    }
  });
});

// ==========================================
// 6. case_derivations
// ==========================================
describe('RLS: case_derivations', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    from_organization_id: ORG_A,
    to_organization_id: ORG_B,
    status: 'pending',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('case_derivations', client, payload);
      } finally {
        await deleteFixtureOrFail('case_derivations', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('case_derivations', client, payload);
      } finally {
        await assertFixtureAbsent('case_derivations', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('case_derivations', payload);
    try {
      for (const client of [adminA, empA, auditorA, clientAsignadoA, clientNoAsignadoA, adminB]) {
        await expectAllowedSelect('case_derivations', client, id);
      }
    } finally {
      await deleteFixtureOrFail('case_derivations', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('case_derivations', payload);
    try {
      for (const client of [inactivoA, adminC, anon]) {
        await expectDeniedSelect('case_derivations', client, id);
      }
    } finally {
      await deleteFixtureOrFail('case_derivations', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_derivations', payload);
      try {
        await expectAllowedUpdate('case_derivations', client, id, { status: 'accepted' });
      } finally {
        await deleteFixtureOrFail('case_derivations', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_derivations', payload);
      try {
        await expectDeniedUpdate('case_derivations', client, id, { status: 'accepted' }, payload);
      } finally {
        await deleteFixtureOrFail('case_derivations', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_derivations', payload);
      try {
        await expectAllowedDelete('case_derivations', client, id);
      } finally {
        await assertFixtureAbsent('case_derivations', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [adminB, auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('case_derivations', payload);
      try {
        await expectDeniedDelete('case_derivations', client, id);
      } finally {
        await deleteFixtureOrFail('case_derivations', id);
      }
    }
  });
});

// ==========================================
// 7. properties
// ==========================================
describe('RLS: properties', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    address: '123 Test St',
    property_type: 'casa',
    status: 'active',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('properties', client, payload);
      } finally {
        await deleteFixtureOrFail('properties', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('properties', client, payload);
      } finally {
        await assertFixtureAbsent('properties', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('properties', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('properties', client, id);
      }
    } finally {
      await deleteFixtureOrFail('properties', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('properties', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('properties', client, id);
      }
    } finally {
      await deleteFixtureOrFail('properties', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('properties', payload);
      try {
        await expectAllowedUpdate('properties', client, id, { property_type: 'departamento' });
      } finally {
        await deleteFixtureOrFail('properties', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('properties', payload);
      try {
        await expectDeniedUpdate('properties', client, id, { property_type: 'departamento' }, payload);
      } finally {
        await deleteFixtureOrFail('properties', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('properties', payload);
      try {
        await expectAllowedDelete('properties', client, id);
      } finally {
        await assertFixtureAbsent('properties', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('properties', payload);
      try {
        await expectDeniedDelete('properties', client, id);
      } finally {
        await deleteFixtureOrFail('properties', id);
      }
    }
  });
});

// ==========================================
// 8. cases.property_id
// ==========================================
describe('RLS: cases.property_id', () => {
  it('RELACIÓN PADRE-HIJO: caso Org A referenciando propiedad Org A permitido', async () => {
    const propId = crypto.randomUUID();
    const propPayload = {
      id: propId,
      organization_id: ORG_A,
      address: '123',
      property_type: 'casa',
      status: 'active',
    };
    await insertFixtureOrFail('properties', propPayload);

    const caseId = crypto.randomUUID();
    try {
      const casePayload = {
        id: caseId,
        organization_id: ORG_A,
        title: 'Prop cross',
        case_type: 'venta',
        status: 'active',
        created_by: SEED_DATA.ADMIN_LEGAL_ID,
        property_id: propId,
      };
      await expectAllowedInsert('cases', adminA, casePayload);
    } finally {
      await deleteFixtureOrFail('cases', caseId);
      await deleteFixtureOrFail('properties', propId);
    }
  });

  it('RELACIÓN PADRE-HIJO: caso Org B referenciando propiedad Org A denegado', async () => {
    const propId = crypto.randomUUID();
    const propPayload = {
      id: propId,
      organization_id: ORG_A,
      address: '123',
      property_type: 'casa',
      status: 'active',
    };
    await insertFixtureOrFail('properties', propPayload);

    const caseId = crypto.randomUUID();
    try {
      const casePayload = {
        id: caseId,
        organization_id: ORG_B,
        title: 'Prop cross',
        case_type: 'venta',
        status: 'active',
        created_by: SEED_DATA.ADMIN_INM_ID,
        property_id: propId,
      };
      await expectIntegrityRejectedInsert('cases', adminB, casePayload);
    } finally {
      await assertFixtureAbsent('cases', caseId);
      await deleteFixtureOrFail('properties', propId);
    }
  });
});

// ==========================================
// 9. clients
// ==========================================
describe('RLS: clients', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    full_name: 'Test Client',
    document_type: 'DNI',
    document_number: '12345678',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('clients', client, payload);
      } finally {
        await deleteFixtureOrFail('clients', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('clients', client, payload);
      } finally {
        await assertFixtureAbsent('clients', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('clients', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('clients', client, id);
      }
    } finally {
      await deleteFixtureOrFail('clients', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('clients', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('clients', client, id);
      }
    } finally {
      await deleteFixtureOrFail('clients', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('clients', payload);
      try {
        await expectAllowedUpdate('clients', client, id, { full_name: 'updated' });
      } finally {
        await deleteFixtureOrFail('clients', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('clients', payload);
      try {
        await expectDeniedUpdate('clients', client, id, { full_name: 'updated' }, payload);
      } finally {
        await deleteFixtureOrFail('clients', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('clients', payload);
      try {
        await expectAllowedDelete('clients', client, id);
      } finally {
        await assertFixtureAbsent('clients', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('clients', payload);
      try {
        await expectDeniedDelete('clients', client, id);
      } finally {
        await deleteFixtureOrFail('clients', id);
      }
    }
  });
});

// ==========================================
// 10. rental_contracts
// ==========================================
describe('RLS: rental_contracts', () => {
  const getPayload = (id: string, propId: string) => ({
    id,
    organization_id: ORG_A,
    property_id: propId,
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    currency: 'ARS',
    amount: 1000,
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      try {
        await expectAllowedInsert('rental_contracts', client, payload);
      } finally {
        await deleteFixtureOrFail('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      try {
        await expectRlsDeniedInsert('rental_contracts', client, payload);
      } finally {
        await assertFixtureAbsent('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const propId = crypto.randomUUID();
    await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
    const id = crypto.randomUUID();
    const payload = getPayload(id, propId);
    await insertFixtureOrFail('rental_contracts', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('rental_contracts', client, id);
      }
    } finally {
      await deleteFixtureOrFail('rental_contracts', id);
      await deleteFixtureOrFail('properties', propId);
    }
  });

  it('SELECT - denegados', async () => {
    const propId = crypto.randomUUID();
    await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
    const id = crypto.randomUUID();
    const payload = getPayload(id, propId);
    await insertFixtureOrFail('rental_contracts', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('rental_contracts', client, id);
      }
    } finally {
      await deleteFixtureOrFail('rental_contracts', id);
      await deleteFixtureOrFail('properties', propId);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('rental_contracts', payload);
      try {
        await expectAllowedUpdate('rental_contracts', client, id, { amount: 2000 });
      } finally {
        await deleteFixtureOrFail('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('rental_contracts', payload);
      try {
        await expectDeniedUpdate('rental_contracts', client, id, { amount: 2000 }, payload);
      } finally {
        await deleteFixtureOrFail('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('rental_contracts', payload);
      try {
        await expectAllowedDelete('rental_contracts', client, id);
      } finally {
        await assertFixtureAbsent('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('rental_contracts', payload);
      try {
        await expectDeniedDelete('rental_contracts', client, id);
      } finally {
        await deleteFixtureOrFail('rental_contracts', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });
});

// ==========================================
// 11. rent_index_values
// ==========================================
describe('RLS: rent_index_values', () => {
  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    index_type: 'ICL',
    date: '2024-01-01',
    value: 1.5,
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('rent_index_values', client, payload);
      } finally {
        await deleteFixtureOrFail('rent_index_values', id);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectRlsDeniedInsert('rent_index_values', client, payload);
      } finally {
        await assertFixtureAbsent('rent_index_values', id);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('rent_index_values', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('rent_index_values', client, id);
      }
    } finally {
      await deleteFixtureOrFail('rent_index_values', id);
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    await insertFixtureOrFail('rent_index_values', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('rent_index_values', client, id);
      }
    } finally {
      await deleteFixtureOrFail('rent_index_values', id);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('rent_index_values', payload);
      try {
        await expectAllowedUpdate('rent_index_values', client, id, { value: 2.0 });
      } finally {
        await deleteFixtureOrFail('rent_index_values', id);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('rent_index_values', payload);
      try {
        await expectDeniedUpdate('rent_index_values', client, id, { value: 2.0 }, payload);
      } finally {
        await deleteFixtureOrFail('rent_index_values', id);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('rent_index_values', payload);
      try {
        await expectAllowedDelete('rent_index_values', client, id);
      } finally {
        await assertFixtureAbsent('rent_index_values', id);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      await insertFixtureOrFail('rent_index_values', payload);
      try {
        await expectDeniedDelete('rent_index_values', client, id);
      } finally {
        await deleteFixtureOrFail('rent_index_values', id);
      }
    }
  });
});

// ==========================================
// 12. property_comparables
// ==========================================
describe('RLS: property_comparables', () => {
  const getPayload = (id: string, propId: string) => ({
    id,
    organization_id: ORG_A,
    property_id: propId,
    address: 'Comparable',
    price: 100000,
    currency: 'USD',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      try {
        await expectAllowedInsert('property_comparables', client, payload);
      } finally {
        await deleteFixtureOrFail('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      try {
        await expectRlsDeniedInsert('property_comparables', client, payload);
      } finally {
        await assertFixtureAbsent('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const propId = crypto.randomUUID();
    await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
    const id = crypto.randomUUID();
    const payload = getPayload(id, propId);
    await insertFixtureOrFail('property_comparables', payload);
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('property_comparables', client, id);
      }
    } finally {
      await deleteFixtureOrFail('property_comparables', id);
      await deleteFixtureOrFail('properties', propId);
    }
  });

  it('SELECT - denegados', async () => {
    const propId = crypto.randomUUID();
    await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
    const id = crypto.randomUUID();
    const payload = getPayload(id, propId);
    await insertFixtureOrFail('property_comparables', payload);
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
        await expectDeniedSelect('property_comparables', client, id);
      }
    } finally {
      await deleteFixtureOrFail('property_comparables', id);
      await deleteFixtureOrFail('properties', propId);
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('property_comparables', payload);
      try {
        await expectAllowedUpdate('property_comparables', client, id, { price: 200000 });
      } finally {
        await deleteFixtureOrFail('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('property_comparables', payload);
      try {
        await expectDeniedUpdate('property_comparables', client, id, { price: 200000 }, payload);
      } finally {
        await deleteFixtureOrFail('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('property_comparables', payload);
      try {
        await expectAllowedDelete('property_comparables', client, id);
      } finally {
        await assertFixtureAbsent('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, adminB, adminC, anon]) {
      const propId = crypto.randomUUID();
      await insertFixtureOrFail('properties', { id: propId, organization_id: ORG_A, address: 'p', property_type: 'casa', status: 'active' });
      const id = crypto.randomUUID();
      const payload = getPayload(id, propId);
      await insertFixtureOrFail('property_comparables', payload);
      try {
        await expectDeniedDelete('property_comparables', client, id);
      } finally {
        await deleteFixtureOrFail('property_comparables', id);
        await deleteFixtureOrFail('properties', propId);
      }
    }
  });

  it('RELACIÓN PADRE-HIJO: negativo cruzado', async () => {
    const otherPropId = crypto.randomUUID();
    const otherPropPayload = {
      id: otherPropId,
      organization_id: ORG_B,
      address: 'Other Prop',
      property_type: 'casa',
      status: 'active',
    };
    await insertFixtureOrFail('properties', otherPropPayload);

    try {
      const id = crypto.randomUUID();
      const payload = { ...getPayload(id, otherPropId), organization_id: ORG_A };
      await expectIntegrityRejectedInsert('property_comparables', adminA, payload);
    } finally {
      await deleteFixtureOrFail('properties', otherPropId);
    }
  });
});
