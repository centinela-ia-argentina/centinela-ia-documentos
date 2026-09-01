import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { SEED_DATA } from '../setup/seed-supabase';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

describe('Seed de Escribanía QA', () => {
  it('A. Autenticación - Todos los usuarios pueden iniciar sesión', async () => {
    const users = [
      'admin.esc@test.com',
      'emp.esc@test.com',
      'auditor.esc@test.com',
      'client.esc@test.com',
    ];

    for (const email of users) {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: 'password123',
      });

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      expect(data.session?.user?.email).toBe(email);
    }
  });

  it('B. Profiles - Existen y están correctamente configurados', async () => {
    const { data: profiles, error } = await serviceClient
      .from('profiles')
      .select('*')
      .in('id', [SEED_DATA.ADMIN_ESC_ID, SEED_DATA.EMPLOYEE_ESC_ID, SEED_DATA.AUDITOR_ESC_ID, SEED_DATA.CLIENT_ESC_ID]);

    expect(error).toBeNull();
    expect(profiles).not.toBeNull();
    expect(profiles?.length).toBe(4);

    for (const p of profiles || []) {
      expect(p.organization_id).toBe(SEED_DATA.ORG_ESC_ID);
      expect(p.status).toBe('active');
    }

    const admin = profiles?.find((p) => p.id === SEED_DATA.ADMIN_ESC_ID);
    expect(admin?.role).toBe('admin');

    const emp = profiles?.find((p) => p.id === SEED_DATA.EMPLOYEE_ESC_ID);
    expect(emp?.role).toBe('employee');

    const auditor = profiles?.find((p) => p.id === SEED_DATA.AUDITOR_ESC_ID);
    expect(auditor?.role).toBe('auditor');

    const client = profiles?.find((p) => p.id === SEED_DATA.CLIENT_ESC_ID);
    expect(client?.role).toBe('client');
  });

  it('C. Organización - Es de tipo escribania', async () => {
    const { data: org, error } = await serviceClient
      .from('organizations')
      .select('*')
      .eq('id', SEED_DATA.ORG_ESC_ID)
      .single();

    expect(error).toBeNull();
    expect(org).toBeDefined();
    expect(org?.industry_type).toBe('escribania');
  });

  it('D. Casos - Casos mínimos obligatorios exactos', async () => {
    const expectedCases = [
      {
        id: SEED_DATA.CASE_ESC_ID,
        title: 'Escritura 1',
        case_type: 'Escritura',
        assigned_to: null,
      },
      {
        id: SEED_DATA.CASE_ESC_PODER_ID,
        title: 'Poder QA',
        case_type: 'Poder',
        assigned_to: null,
      },
      {
        id: SEED_DATA.CASE_ESC_CERTIFICACION_ID,
        title: 'Certificación QA',
        case_type: 'Certificación de firmas',
        assigned_to: null,
      },
      {
        id: SEED_DATA.CASE_ESC_ACTA_ID,
        title: 'Acta QA',
        case_type: 'Acta notarial',
        assigned_to: null,
      },
      {
        id: SEED_DATA.CASE_ESC_SUCESION_ID,
        title: 'Sucesión QA',
        case_type: 'Sucesión',
        assigned_to: SEED_DATA.CLIENT_ESC_ID,
      },
    ];

    const expectedIds = expectedCases.map(c => c.id);

    const { data: cases, error } = await serviceClient
      .from('cases')
      .select('*')
      .in('id', expectedIds);

    expect(error).toBeNull();
    expect(cases).not.toBeNull();
    expect(cases?.length).toBe(5);

    for (const expected of expectedCases) {
      const foundCase = cases?.find((c) => c.id === expected.id);
      expect(foundCase).toBeDefined();
      expect(foundCase?.title).toBe(expected.title);
      expect(foundCase?.case_type).toBe(expected.case_type);
      expect(foundCase?.organization_id).toBe(SEED_DATA.ORG_ESC_ID);
      expect(foundCase?.created_by).toBe(SEED_DATA.ADMIN_ESC_ID);
      expect(foundCase?.status).toBe('active');
      expect(foundCase?.assigned_to).toBe(expected.assigned_to);
    }
  });
});
