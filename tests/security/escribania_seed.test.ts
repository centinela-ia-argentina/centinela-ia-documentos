import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan credenciales de Supabase locales');
}

if (supabaseUrl.includes('supabase.co')) {
  throw new Error('CUIDADO: Estas pruebas no deben ejecutarse contra Producción');
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ESC_ID = '33333333-3333-3333-3333-333333333333';
const ADMIN_ESC_ID = 'cccc3333-3333-3333-3333-333333333333';
const EMPLOYEE_ESC_ID = 'aaaa3333-3333-3333-3333-333333333333';
const AUDITOR_ESC_ID = 'bbbb3333-3333-3333-3333-333333333333';
const CLIENT_ESC_ID = 'dddd3333-3333-3333-3333-333333333333';

describe('Seed de Escribanía QA', () => {
  it('A. Autenticación - Todos los usuarios pueden iniciar sesión', async () => {
    const users = [
      'admin.esc@test.com',
      'emp.esc@test.com',
      'auditor.esc@test.com',
      'client.esc@test.com',
    ];

    for (const email of users) {
      const client = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
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
      .in('id', [ADMIN_ESC_ID, EMPLOYEE_ESC_ID, AUDITOR_ESC_ID, CLIENT_ESC_ID]);

    expect(error).toBeNull();
    expect(profiles).not.toBeNull();
    expect(profiles?.length).toBe(4);

    for (const p of profiles || []) {
      expect(p.organization_id).toBe(ORG_ESC_ID);
      expect(p.status).toBe('active');
    }

    const admin = profiles?.find((p) => p.id === ADMIN_ESC_ID);
    expect(admin?.role).toBe('admin');

    const emp = profiles?.find((p) => p.id === EMPLOYEE_ESC_ID);
    expect(emp?.role).toBe('employee');

    const auditor = profiles?.find((p) => p.id === AUDITOR_ESC_ID);
    expect(auditor?.role).toBe('auditor');

    const client = profiles?.find((p) => p.id === CLIENT_ESC_ID);
    expect(client?.role).toBe('client');
  });

  it('C. Organización - Es de tipo escribania', async () => {
    const { data: org, error } = await serviceClient
      .from('organizations')
      .select('*')
      .eq('id', ORG_ESC_ID)
      .single();

    expect(error).toBeNull();
    expect(org).toBeDefined();
    expect(org?.industry_type).toBe('escribania');
  });

  it('D. Casos - Casos mínimos obligatorios', async () => {
    const { data: cases, error } = await serviceClient
      .from('cases')
      .select('*')
      .eq('organization_id', ORG_ESC_ID);

    expect(error).toBeNull();
    expect(cases).not.toBeNull();
    
    expect(cases?.length).toBeGreaterThanOrEqual(5);

    const typesFound = cases?.map((c) => c.case_type);
    
    expect(typesFound).toContain('Escritura');
    expect(typesFound).toContain('Poder');
    expect(typesFound).toContain('Certificación de firmas');
    expect(typesFound).toContain('Acta notarial');
    expect(typesFound).toContain('Sucesión');

    let hasClientAssigned = false;

    for (const c of cases || []) {
      expect(c.organization_id).toBe(ORG_ESC_ID);
      expect(c.created_by).toBe(ADMIN_ESC_ID);
      expect(c.status).toBe('active');

      if (c.assigned_to === CLIENT_ESC_ID) {
        hasClientAssigned = true;
      }
    }

    expect(hasClientAssigned).toBe(true);
  });
});
