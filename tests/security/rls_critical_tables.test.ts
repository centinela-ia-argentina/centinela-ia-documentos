import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

function assertIsRlsError(error: any) {
  if (!error) return;
  const invalidCodes = ['PGRST204', '42703', '23502', '23514'];
  if (invalidCodes.includes(error.code)) {
    throw new Error(`Falso positivo de RLS: error de esquema (${error.code}: ${error.message})`);
  }
}

async function expectDeniedInsert(table: string, client: SupabaseClient, payload: any) {
  const { data, error } = await client.from(table).insert(payload).select();
  if (error) assertIsRlsError(error);
  expect(data === null || data.length === 0).toBe(true);

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', payload.id);
  expect(vErr).toBeNull();
  expect(verify?.length).toBe(0);
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
  if (error) assertIsRlsError(error);
  expect(data === null || data.length === 0).toBe(true);

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
  if (error) assertIsRlsError(error);
  expect(data === null || data.length === 0).toBe(true);

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', id);
  expect(vErr).toBeNull();
  expect(verify?.length).toBe(1);
}

async function expectAllowedDelete(table: string, client: SupabaseClient, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  expect(error).toBeNull();

  const { data: verify, error: vErr } = await serviceClient.from(table).select('*').eq('id', id);
  expect(vErr).toBeNull();
  expect(verify?.length).toBe(0);
}

async function expectDeniedSelect(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).select('*').eq('id', id);
  if (error) assertIsRlsError(error);
  expect(data === null || data.length === 0).toBe(true);
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
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('documents', client, payload);
      } finally {
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('documents').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA, clientAsignadoA]) {
        await expectAllowedSelect('documents', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('documents').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('documents').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientNoAsignadoA, adminB, inactivoA, anon]) {
        await expectDeniedSelect('documents', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('documents').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('documents').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('documents', client, id, { file_name: 'updated.pdf' });
      } finally {
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('documents').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('documents', client, id, { file_name: 'updated.pdf' }, payload);
      } finally {
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('documents').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('documents', client, id);
      } finally {
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('documents').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('documents', client, id);
      } finally {
        const { error } = await serviceClient.from('documents').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO: positivo org A', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    try {
      await expectAllowedInsert('documents', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('documents').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('RELACIÃ“N PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectDeniedInsert('documents', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('documents').delete().eq('id', id);
      expect(error).toBeNull();
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
        const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('ai_outputs', client, payload);
      } finally {
        const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('ai_outputs').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('ai_outputs', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('ai_outputs').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
        await expectDeniedSelect('ai_outputs', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - denegados para todos', async () => {
    for (const client of [adminA, empA, auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('ai_outputs').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('ai_outputs', client, id, { output_type: 'classification' }, payload);
      } finally {
        const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('ai_outputs').insert(payload);
    expect(errInsert).toBeNull();
    try {
      await expectAllowedDelete('ai_outputs', adminA, id);
    } finally {
      const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [empA, auditorA, clientAsignadoA, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('ai_outputs').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('ai_outputs', client, id);
      } finally {
        const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO (case): negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectDeniedInsert('ai_outputs', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('ai_outputs').delete().eq('id', id);
      expect(error).toBeNull();
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
        const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('agent_messages', client, payload);
      } finally {
        const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('agent_messages').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('agent_messages', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('agent_messages').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
        await expectDeniedSelect('agent_messages', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - denegados para todos', async () => {
    for (const client of [adminA, empA, auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('agent_messages').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('agent_messages', client, id, { content: 'updated' }, payload);
      } finally {
        const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('agent_messages').insert(payload);
    expect(errInsert).toBeNull();
    try {
      await expectAllowedDelete('agent_messages', adminA, id);
    } finally {
      const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [empA, auditorA, clientAsignadoA, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('agent_messages').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('agent_messages', client, id);
      } finally {
        const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectDeniedInsert('agent_messages', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('agent_messages').delete().eq('id', id);
      expect(error).toBeNull();
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
    event_date: new Date().toISOString(),
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
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, inactivoA, anon, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('case_events', client, payload);
      } finally {
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA, clientAsignadoA]) {
        await expectAllowedSelect('case_events', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('case_events').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientNoAsignadoA, adminB, inactivoA, anon]) {
        await expectDeniedSelect('case_events', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('case_events').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('case_events', client, id, { description: 'updated' });
      } finally {
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('case_events', client, id, { description: 'updated' }, payload);
      } finally {
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('case_events', client, id);
      } finally {
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, clientNoAsignadoA, adminB, inactivoA, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_events').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('case_events', client, id);
      } finally {
        const { error } = await serviceClient.from('case_events').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectDeniedInsert('case_events', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('case_events').delete().eq('id', id);
      expect(error).toBeNull();
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
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('reports', client, payload);
      } finally {
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('reports').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('reports', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('reports').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('reports').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('reports', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('reports').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('reports').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('reports', client, id, { title: 'updated' });
      } finally {
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('reports').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('reports', client, id, { title: 'updated' }, payload);
      } finally {
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('reports').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('reports', client, id);
      } finally {
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('reports').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('reports', client, id);
      } finally {
        const { error } = await serviceClient.from('reports').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO: negativo cruzado (Org A, Case B)', async () => {
    const id = crypto.randomUUID();
    const payload = { ...getPayload(id), case_id: CASE_B };
    try {
      await expectDeniedInsert('reports', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('reports').delete().eq('id', id);
      expect(error).toBeNull();
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
        const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('case_derivations', client, payload);
      } finally {
        const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, adminB]) {
        await expectAllowedSelect('case_derivations', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminC, anon]) {
        await expectDeniedSelect('case_derivations', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, adminB]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('case_derivations', client, id, { status: 'accepted' });
      } finally {
        const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('case_derivations', client, id, { status: 'accepted' }, payload);
      } finally {
        const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
    expect(errInsert).toBeNull();
    try {
      await expectAllowedDelete('case_derivations', adminA, id);
    } finally {
      const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [adminB, adminC, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('case_derivations').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('case_derivations', client, id);
      } finally {
        const { error } = await serviceClient.from('case_derivations').delete().eq('id', id);
        expect(error).toBeNull();
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
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('properties', client, payload);
      } finally {
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('properties').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('properties', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('properties').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('properties').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('properties', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('properties').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('properties').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('properties', client, id, { property_type: 'departamento' });
      } finally {
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('properties').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('properties', client, id, { property_type: 'departamento' }, payload);
      } finally {
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('properties').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('properties', client, id);
      } finally {
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('properties').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('properties', client, id);
      } finally {
        const { error } = await serviceClient.from('properties').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });
});

// ==========================================
// 8. cases.property_id
// ==========================================
describe('RLS: cases.property_id', () => {
  it('RELACIÃ“N PADRE-HIJO: caso org B referenciando propiedad org A denegado', async () => {
    const propId = crypto.randomUUID();
    const propPayload = {
      id: propId,
      organization_id: ORG_A,
      address: '123',
      property_type: 'casa',
      status: 'active',
    };
    const { error: errInsert } = await serviceClient.from('properties').insert(propPayload);
    expect(errInsert).toBeNull();

    try {
      const caseId = crypto.randomUUID();
      const casePayload = {
        id: caseId,
        organization_id: ORG_B,
        title: 'Prop cross',
        case_type: 'venta',
        status: 'active',
        created_by: SEED_DATA.ADMIN_INM_ID,
        property_id: propId,
      };
      await expectDeniedInsert('cases', adminB, casePayload);
    } finally {
      const { error } = await serviceClient.from('properties').delete().eq('id', propId);
      expect(error).toBeNull();
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
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('clients', client, payload);
      } finally {
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('clients').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('clients', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('clients').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('clients').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('clients', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('clients').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('clients').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('clients', client, id, { full_name: 'updated' });
      } finally {
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('clients').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('clients', client, id, { full_name: 'updated' }, payload);
      } finally {
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('clients').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('clients', client, id);
      } finally {
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('clients').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('clients', client, id);
      } finally {
        const { error } = await serviceClient.from('clients').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });
});

// ==========================================
// 10. rental_contracts
// ==========================================
describe('RLS: rental_contracts', () => {
  const propId = crypto.randomUUID();
  const propPayload = {
    id: propId,
    organization_id: ORG_A,
    address: 'Prop for contract',
    property_type: 'casa',
    status: 'active',
  };

  beforeAll(async () => {
    const { error } = await serviceClient.from('properties').insert(propPayload);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    const { error } = await serviceClient.from('properties').delete().eq('id', propId);
    expect(error).toBeNull();
  });

  const getPayload = (id: string) => ({
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
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('rental_contracts', client, payload);
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('rental_contracts', client, payload);
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('rental_contracts', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('rental_contracts', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('rental_contracts', client, id, { amount: 2000 });
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('rental_contracts', client, id, { amount: 2000 }, payload);
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('rental_contracts', client, id);
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rental_contracts').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('rental_contracts', client, id);
      } finally {
        const { error } = await serviceClient.from('rental_contracts').delete().eq('id', id);
        expect(error).toBeNull();
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
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('rent_index_values', client, payload);
      } finally {
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('rent_index_values', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('rent_index_values', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('rent_index_values', client, id, { value: 2.0 });
      } finally {
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('rent_index_values', client, id, { value: 2.0 }, payload);
      } finally {
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('rent_index_values', client, id);
      } finally {
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('rent_index_values').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('rent_index_values', client, id);
      } finally {
        const { error } = await serviceClient.from('rent_index_values').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });
});

// ==========================================
// 12. property_comparables
// ==========================================
describe('RLS: property_comparables', () => {
  const propId = crypto.randomUUID();
  const propPayload = {
    id: propId,
    organization_id: ORG_A,
    address: 'Prop for comparable',
    property_type: 'casa',
    status: 'active',
  };

  beforeAll(async () => {
    const { error } = await serviceClient.from('properties').insert(propPayload);
    expect(error).toBeNull();
  });

  afterAll(async () => {
    const { error } = await serviceClient.from('properties').delete().eq('id', propId);
    expect(error).toBeNull();
  });

  const getPayload = (id: string) => ({
    id,
    organization_id: ORG_A,
    property_id: propId,
    address: 'Comparable',
    price: 100000,
    currency: 'USD',
  });

  it('INSERT - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectAllowedInsert('property_comparables', client, payload);
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('INSERT - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      try {
        await expectDeniedInsert('property_comparables', client, payload);
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('SELECT - permitidos', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [adminA, empA, auditorA]) {
        await expectAllowedSelect('property_comparables', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('SELECT - denegados', async () => {
    const id = crypto.randomUUID();
    const payload = getPayload(id);
    const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
    expect(errInsert).toBeNull();
    try {
      for (const client of [clientAsignadoA, adminB, anon]) {
        await expectDeniedSelect('property_comparables', client, id);
      }
    } finally {
      const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
      expect(error).toBeNull();
    }
  });

  it('UPDATE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedUpdate('property_comparables', client, id, { price: 200000 });
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('UPDATE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedUpdate('property_comparables', client, id, { price: 200000 }, payload);
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - permitidos', async () => {
    for (const client of [adminA, empA]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectAllowedDelete('property_comparables', client, id);
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('DELETE - denegados', async () => {
    for (const client of [auditorA, clientAsignadoA, adminB, anon]) {
      const id = crypto.randomUUID();
      const payload = getPayload(id);
      const { error: errInsert } = await serviceClient.from('property_comparables').insert(payload);
      expect(errInsert).toBeNull();
      try {
        await expectDeniedDelete('property_comparables', client, id);
      } finally {
        const { error } = await serviceClient.from('property_comparables').delete().eq('id', id);
        expect(error).toBeNull();
      }
    }
  });

  it('RELACIÃ“N PADRE-HIJO: negativo cruzado', async () => {
    const otherPropId = crypto.randomUUID();
    const otherPropPayload = {
      id: otherPropId,
      organization_id: ORG_B,
      address: 'Other Prop',
      property_type: 'casa',
      status: 'active',
    };
    const { error: errInsert } = await serviceClient.from('properties').insert(otherPropPayload);
    expect(errInsert).toBeNull();

    try {
      const id = crypto.randomUUID();
      const payload = { ...getPayload(id), property_id: otherPropId };
      await expectDeniedInsert('property_comparables', adminA, payload);
    } finally {
      const { error } = await serviceClient.from('properties').delete().eq('id', otherPropId);
      expect(error).toBeNull();
    }
  });
});
