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

if (!process.env.ALLOW_DESTRUCTIVE_TESTS) {
  throw new Error('ALLOW_DESTRUCTIVE_TESTS is required');
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

function getAuthClient(email: string): SupabaseClient {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

let adminA: SupabaseClient;
let empA: SupabaseClient;
let auditorA: SupabaseClient;
let clientAsignadoA: SupabaseClient;
let clientNoAsignadoA: SupabaseClient;
let inactivoA: SupabaseClient;
let adminB: SupabaseClient;
let anon: SupabaseClient;

beforeAll(async () => {
  adminA = getAuthClient('admin.legal@test.com');
  await adminA.auth.signInWithPassword({ email: 'admin.legal@test.com', password: 'password123' });

  empA = getAuthClient('emp.legal@test.com');
  await empA.auth.signInWithPassword({ email: 'emp.legal@test.com', password: 'password123' });

  auditorA = getAuthClient('auditor.legal@test.com');
  await auditorA.auth.signInWithPassword({ email: 'auditor.legal@test.com', password: 'password123' });

  clientAsignadoA = getAuthClient('client.assigned@test.com');
  await clientAsignadoA.auth.signInWithPassword({ email: 'client.assigned@test.com', password: 'password123' });

  clientNoAsignadoA = getAuthClient('client.unassigned@test.com');
  await clientNoAsignadoA.auth.signInWithPassword({ email: 'client.unassigned@test.com', password: 'password123' });

  inactivoA = getAuthClient('inactive.legal@test.com');
  await inactivoA.auth.signInWithPassword({ email: 'inactive.legal@test.com', password: 'password123' });

  adminB = getAuthClient('admin.inm@test.com');
  await adminB.auth.signInWithPassword({ email: 'admin.inm@test.com', password: 'password123' });

  anon = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

const ORG_A = SEED_DATA.ORG_LEGAL_ID;
const ORG_B = SEED_DATA.ORG_INM_ID;
const CASE_A = SEED_DATA.CASE_LEGAL_ID;
const CASE_B = SEED_DATA.CASE_INM_ID;
const DOC_A = SEED_DATA.DOC_LEGAL_ID;

// Helpers to test denied and allowed
async function expectDeniedInsert(table: string, client: SupabaseClient, payload: any) {
  const { data, error } = await client.from(table).insert(payload).select();
  expect(data === null || data.length === 0).toBe(true);
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', payload.id);
  expect(verify?.length).toBe(0);
}

async function expectAllowedInsert(table: string, client: SupabaseClient, payload: any) {
  const { error } = await client.from(table).insert(payload);
  expect(error).toBeNull();
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', payload.id);
  expect(verify?.length).toBe(1);
}

async function expectDeniedUpdate(table: string, client: SupabaseClient, id: string, payload: any, originalObj: any) {
  const { data, error } = await client.from(table).update(payload).eq('id', id).select();
  expect(data === null || data.length === 0).toBe(true);
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', id).single();
  const keyToVerify = Object.keys(payload)[0];
  expect(verify[keyToVerify]).toEqual(originalObj[keyToVerify]);
}

async function expectAllowedUpdate(table: string, client: SupabaseClient, id: string, payload: any) {
  const { error } = await client.from(table).update(payload).eq('id', id);
  expect(error).toBeNull();
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', id).single();
  const keyToVerify = Object.keys(payload)[0];
  expect(verify[keyToVerify]).toEqual(payload[keyToVerify]);
}

async function expectDeniedDelete(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).delete().eq('id', id).select();
  expect(data === null || data.length === 0).toBe(true);
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', id);
  expect(verify?.length).toBe(1);
}

async function expectAllowedDelete(table: string, client: SupabaseClient, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  expect(error).toBeNull();
  
  const { data: verify } = await serviceClient.from(table).select('*').eq('id', id);
  expect(verify?.length).toBe(0);
}

async function expectDeniedSelect(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).select('*').eq('id', id);
  expect(data === null || data.length === 0).toBe(true);
}

async function expectAllowedSelect(table: string, client: SupabaseClient, id: string) {
  const { data, error } = await client.from(table).select('*').eq('id', id);
  expect(error).toBeNull();
  expect(data?.length).toBe(1);
}

// 1. documents
describe('RLS: documents', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    file_name: 'test.pdf',
    file_path: 'test.pdf',
    file_size: 100,
    file_mime_type: 'application/pdf',
  };

  afterAll(async () => { await serviceClient.from('documents').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('documents', auditorA, payload);
    await expectDeniedInsert('documents', clientAsignadoA, payload);
    await expectDeniedInsert('documents', inactivoA, payload);
    await expectDeniedInsert('documents', adminB, payload);
    await expectDeniedInsert('documents', anon, payload);
    await expectAllowedInsert('documents', adminA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('documents', adminA, id);
    await expectAllowedSelect('documents', empA, id);
    await expectAllowedSelect('documents', auditorA, id);
    await expectAllowedSelect('documents', clientAsignadoA, id);
    
    await expectDeniedSelect('documents', clientNoAsignadoA, id);
    await expectDeniedSelect('documents', adminB, id);
    await expectDeniedSelect('documents', inactivoA, id);
    await expectDeniedSelect('documents', anon, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { file_name: 'updated.pdf' };
    await expectDeniedUpdate('documents', auditorA, id, updatePayload, payload);
    await expectDeniedUpdate('documents', clientAsignadoA, id, updatePayload, payload);
    await expectAllowedUpdate('documents', empA, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('documents', auditorA, id);
    await expectDeniedDelete('documents', clientAsignadoA, id);
    await expectAllowedDelete('documents', adminA, id);
  });
});

// 2. ai_outputs
describe('RLS: ai_outputs', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    document_id: DOC_A,
    output_type: 'summary',
    content: { test: 1 },
  };

  afterAll(async () => { await serviceClient.from('ai_outputs').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('ai_outputs', auditorA, payload);
    await expectDeniedInsert('ai_outputs', clientAsignadoA, payload);
    await expectDeniedInsert('ai_outputs', adminB, payload);
    await expectAllowedInsert('ai_outputs', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('ai_outputs', adminA, id);
    await expectAllowedSelect('ai_outputs', empA, id);
    await expectAllowedSelect('ai_outputs', auditorA, id);
    
    await expectDeniedSelect('ai_outputs', clientAsignadoA, id);
    await expectDeniedSelect('ai_outputs', adminB, id);
    await expectDeniedSelect('ai_outputs', anon, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { output_type: 'new_type' };
    await expectDeniedUpdate('ai_outputs', adminA, id, updatePayload, payload);
    await expectDeniedUpdate('ai_outputs', empA, id, updatePayload, payload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('ai_outputs', empA, id);
    await expectAllowedDelete('ai_outputs', adminA, id);
  });
});

// 3. agent_messages
describe('RLS: agent_messages', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    role: 'user',
    content: 'test',
  };

  afterAll(async () => { await serviceClient.from('agent_messages').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('agent_messages', auditorA, payload);
    await expectDeniedInsert('agent_messages', clientAsignadoA, payload);
    await expectAllowedInsert('agent_messages', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('agent_messages', adminA, id);
    await expectAllowedSelect('agent_messages', empA, id);
    await expectAllowedSelect('agent_messages', auditorA, id);
    
    await expectDeniedSelect('agent_messages', clientAsignadoA, id);
    await expectDeniedSelect('agent_messages', adminB, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { content: 'updated' };
    await expectDeniedUpdate('agent_messages', adminA, id, updatePayload, payload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('agent_messages', empA, id);
    await expectAllowedDelete('agent_messages', adminA, id);
  });
});

// 4. case_events
describe('RLS: case_events', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    event_type: 'test_event',
    description: 'test',
  };

  afterAll(async () => { await serviceClient.from('case_events').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('case_events', auditorA, payload);
    await expectDeniedInsert('case_events', clientAsignadoA, payload);
    await expectAllowedInsert('case_events', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('case_events', adminA, id);
    await expectAllowedSelect('case_events', empA, id);
    await expectAllowedSelect('case_events', auditorA, id);
    await expectAllowedSelect('case_events', clientAsignadoA, id);
    
    await expectDeniedSelect('case_events', clientNoAsignadoA, id);
    await expectDeniedSelect('case_events', adminB, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { description: 'updated' };
    await expectDeniedUpdate('case_events', clientAsignadoA, id, updatePayload, payload);
    await expectAllowedUpdate('case_events', adminA, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('case_events', auditorA, id);
    await expectAllowedDelete('case_events', empA, id);
  });
});

// 5. reports
describe('RLS: reports', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    name: 'test_report',
    report_type: 'test',
  };

  afterAll(async () => { await serviceClient.from('reports').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('reports', auditorA, payload);
    await expectDeniedInsert('reports', clientAsignadoA, payload);
    await expectAllowedInsert('reports', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('reports', adminA, id);
    await expectAllowedSelect('reports', empA, id);
    await expectAllowedSelect('reports', auditorA, id);
    
    await expectDeniedSelect('reports', clientAsignadoA, id);
    await expectDeniedSelect('reports', adminB, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { name: 'updated' };
    await expectDeniedUpdate('reports', clientAsignadoA, id, updatePayload, payload);
    await expectAllowedUpdate('reports', adminA, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('reports', auditorA, id);
    await expectAllowedDelete('reports', empA, id);
  });
});

// 6. case_derivations
describe('RLS: case_derivations', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    case_id: CASE_A,
    from_organization_id: ORG_A,
    to_organization_id: ORG_B,
    status: 'pending',
  };

  afterAll(async () => { await serviceClient.from('case_derivations').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('case_derivations', auditorA, payload);
    await expectDeniedInsert('case_derivations', clientAsignadoA, payload);
    await expectDeniedInsert('case_derivations', adminB, payload);
    await expectAllowedInsert('case_derivations', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('case_derivations', adminA, id);
    await expectAllowedSelect('case_derivations', adminB, id);
    
    await expectDeniedSelect('case_derivations', anon, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { status: 'accepted' };
    await expectAllowedUpdate('case_derivations', adminB, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('case_derivations', adminB, id);
    await expectAllowedDelete('case_derivations', empA, id);
  });
});

// 7. properties
describe('RLS: properties', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_B,
    case_id: CASE_B,
    address: '123 Test St',
    property_type: 'casa',
    status: 'active',
  };

  afterAll(async () => { await serviceClient.from('properties').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('properties', adminA, payload);
    await expectAllowedInsert('properties', adminB, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('properties', adminB, id);
    await expectDeniedSelect('properties', adminA, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { property_type: 'departamento' };
    await expectAllowedUpdate('properties', adminB, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('properties', adminA, id);
    await expectAllowedDelete('properties', adminB, id);
  });
});

// 8. clients
describe('RLS: clients', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    full_name: 'Test Client',
    document_type: 'DNI',
    document_number: '12345678',
  };

  afterAll(async () => { await serviceClient.from('clients').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('clients', auditorA, payload);
    await expectDeniedInsert('clients', adminB, payload);
    await expectAllowedInsert('clients', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('clients', adminA, id);
    await expectAllowedSelect('clients', auditorA, id);
    await expectDeniedSelect('clients', clientAsignadoA, id);
    await expectDeniedSelect('clients', adminB, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { full_name: 'Updated' };
    await expectAllowedUpdate('clients', adminA, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectDeniedDelete('clients', auditorA, id);
    await expectAllowedDelete('clients', empA, id);
  });
});

// 9. rental_contracts
describe('RLS: rental_contracts', () => {
  const propId = crypto.randomUUID();
  const propPayload = {
    id: propId,
    organization_id: ORG_B,
    case_id: CASE_B,
    address: 'Prop for contract',
    property_type: 'casa',
    status: 'active',
  };

  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_B,
    property_id: propId,
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    currency: 'ARS',
    amount: 1000,
  };

  beforeAll(async () => { await serviceClient.from('properties').insert(propPayload); });
  afterAll(async () => {
    await serviceClient.from('rental_contracts').delete().eq('id', id);
    await serviceClient.from('properties').delete().eq('id', propId);
  });

  it('INSERT', async () => {
    await expectDeniedInsert('rental_contracts', adminA, payload);
    await expectAllowedInsert('rental_contracts', adminB, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('rental_contracts', adminB, id);
    await expectDeniedSelect('rental_contracts', adminA, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { amount: 2000 };
    await expectAllowedUpdate('rental_contracts', adminB, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectAllowedDelete('rental_contracts', adminB, id);
  });
});

// 10. rent_index_values
describe('RLS: rent_index_values', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_A,
    index_type: 'ICL',
    date: '2024-01-01',
    value: 1.5,
  };

  afterAll(async () => { await serviceClient.from('rent_index_values').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('rent_index_values', auditorA, payload);
    await expectAllowedInsert('rent_index_values', empA, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('rent_index_values', empA, id);
    await expectDeniedSelect('rent_index_values', clientAsignadoA, id);
    await expectDeniedSelect('rent_index_values', adminB, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { value: 2.0 };
    await expectAllowedUpdate('rent_index_values', adminA, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectAllowedDelete('rent_index_values', adminA, id);
  });
});

// 11. property_comparables
describe('RLS: property_comparables', () => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    organization_id: ORG_B,
    address: 'Comparable',
    price: 100000,
    currency: 'USD',
  };

  afterAll(async () => { await serviceClient.from('property_comparables').delete().eq('id', id); });

  it('INSERT', async () => {
    await expectDeniedInsert('property_comparables', adminA, payload);
    await expectAllowedInsert('property_comparables', adminB, payload);
  });

  it('SELECT', async () => {
    await expectAllowedSelect('property_comparables', adminB, id);
    await expectDeniedSelect('property_comparables', adminA, id);
  });

  it('UPDATE', async () => {
    const updatePayload = { price: 200000 };
    await expectAllowedUpdate('property_comparables', adminB, id, updatePayload);
  });

  it('DELETE', async () => {
    await expectAllowedDelete('property_comparables', adminB, id);
  });
});
