import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials for RLS tests.');
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('Cases DELETE Restrictions (admin only)', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let auditorALegal: any;
  let clientALegal: any;
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

    anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

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
  });

  const createDummyCase = async (orgId: string) => {
    const caseId = randomUUID();
    const { error } = await serviceClient.from('cases').insert({
      id: caseId,
      organization_id: orgId,
      title: 'Dummy Case ' + caseId,
      client_name: 'Dummy Client',
      case_type: 'civil',
      status: 'active',
      created_by: SEED_DATA.ADMIN_LEGAL_ID,
      assigned_to: SEED_DATA.EMPLOYEE_LEGAL_ID
    });
    expect(error).toBeNull();
    return caseId;
  };

  const cleanupCase = async (caseId: string) => {
    await serviceClient.from('cases').delete().eq('id', caseId);
  };

  it('1. Admin same tenant -> Success', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    const { error } = await adminALegal.from('cases').delete().eq('id', caseId);
    expect(error).toBeNull();

    // Verify row is actually gone
    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).toBeNull();
  });

  it('2. Employee same tenant -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await employeeALegal.from('cases').delete().eq('id', caseId);

    // Verify row still exists
    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    await cleanupCase(caseId);
  });

  it('3. Auditor same tenant -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await auditorALegal.from('cases').delete().eq('id', caseId);

    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    await cleanupCase(caseId);
  });

  it('4. Client same tenant -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await clientALegal.from('cases').delete().eq('id', caseId);

    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    await cleanupCase(caseId);
  });

  it('5. Inactive user -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await inactiveALegal.from('cases').delete().eq('id', caseId);

    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    await cleanupCase(caseId);
  });

  it('6. Admin other tenant -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await adminBInm.from('cases').delete().eq('id', caseId);

    const { data } = await serviceClient.from('cases').select('id, organization_id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    expect(data?.organization_id).toBe(SEED_DATA.ORG_LEGAL_ID); // Not altered
    await cleanupCase(caseId);
  });

  it('7. Anonymous -> Fail', async () => {
    const caseId = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await anonClient.from('cases').delete().eq('id', caseId);

    const { data } = await serviceClient.from('cases').select('id').eq('id', caseId).maybeSingle();
    expect(data).not.toBeNull();
    await cleanupCase(caseId);
  });
});
