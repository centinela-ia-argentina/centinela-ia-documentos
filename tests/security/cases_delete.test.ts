import { describe, it, expect, beforeAll, afterEach } from 'vitest';
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

  const createdCases = new Set<string>();

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }

    const host = new URL(supabaseUrl).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Solo se permite Supabase local.');
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

  afterEach(async () => {
    const pendingIds = [...createdCases];
    createdCases.clear();

    const results = await Promise.all(
      pendingIds.map((caseId) =>
        serviceClient.from('cases').delete().eq('id', caseId)
      )
    );

    const cleanupErrors = results
      .map((result) => result.error)
      .filter(Boolean);

    expect(cleanupErrors).toHaveLength(0);
  });

  const createDummyCase = async (orgId: string, assignedTo: string = SEED_DATA.EMPLOYEE_LEGAL_ID) => {
    const caseId = randomUUID();
    const caseData = {
      id: caseId,
      organization_id: orgId,
      title: 'Dummy Case ' + caseId,
      client_name: 'Dummy Client',
      case_type: 'civil',
      status: 'active',
      created_by: SEED_DATA.ADMIN_LEGAL_ID,
      assigned_to: assignedTo
    };
    const { error } = await serviceClient.from('cases').insert(caseData);
    expect(error).toBeNull();
    createdCases.add(caseId);
    return caseData;
  };

  const verifyCaseIntact = async (originalCase: any) => {
    const { data, error } = await serviceClient
      .from('cases')
      .select('id, organization_id, title, assigned_to')
      .eq('id', originalCase.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.id).toBe(originalCase.id);
    expect(data?.organization_id).toBe(originalCase.organization_id);
    expect(data?.title).toBe(originalCase.title);
    expect(data?.assigned_to).toBe(originalCase.assigned_to);
  };

  it('1. Admin same tenant -> Success', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    const { error } = await adminALegal.from('cases').delete().eq('id', dummy.id);
    expect(error).toBeNull();

    const { data, error: verifyError } = await serviceClient
      .from('cases')
      .select('id')
      .eq('id', dummy.id)
      .maybeSingle();

    expect(verifyError).toBeNull();
    expect(data).toBeNull();

    createdCases.delete(dummy.id);
  });

  it('2. Employee same tenant -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await employeeALegal.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });

  it('3. Auditor same tenant -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await auditorALegal.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });

  it('4. Client same tenant -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID, SEED_DATA.CLIENT_ASSIGNED_ID);
    await clientALegal.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });

  it('5. Inactive user -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await inactiveALegal.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });

  it('6. Admin other tenant -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await adminBInm.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });

  it('7. Anonymous -> Fail', async () => {
    const dummy = await createDummyCase(SEED_DATA.ORG_LEGAL_ID);
    await anonClient.from('cases').delete().eq('id', dummy.id);
    await verifyCaseIntact(dummy);
  });
});
