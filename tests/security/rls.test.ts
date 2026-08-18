import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { SEED_DATA } from '../setup/seed-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials for RLS tests.');
}

const serviceClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe('Pruebas de Seguridad y RLS con JWT Reales', () => {
  let adminALegal: any;
  let employeeALegal: any;
  let adminBInm: any;

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos y requieren un entorno local de Supabase. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }
    if (supabaseUrl.includes('supabase.co')) {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Detectada URL de Production. Abortando pruebas de seguridad.');
    }

    // Usamos los IDs sembrados en seed-supabase.ts
    // Iniciar sesión con los usuarios del seed
    const login = async (email: string) => {
      const { data: sessionData } = await serviceClient.auth.signInWithPassword({
        email,
        password: 'password123',
      });
      return {
        client: createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
          global: { headers: { Authorization: `Bearer ${sessionData.session?.access_token}` } },
          auth: { persistSession: false },
        }),
      };
    };

    adminALegal = await login('admin.legal@test.com');
    employeeALegal = await login('emp.legal@test.com');
    adminBInm = await login('admin.inm@test.com');
  });

  it('Verifica Aislamiento Multi-Tenant en Expedientes', async () => {
    // Admin Inm (B) no debería poder ver el caso de Legal (A)
    const { data: readB, error: readErrorB } = await adminBInm.client.from('cases').select('*').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(readErrorB).toBeNull();
    expect(readB?.length).toBe(0);

    // Admin Legal (A) lee el caso de Legal (A)
    const { data: readA, error: readErrorA } = await adminALegal.client.from('cases').select('*').eq('id', SEED_DATA.CASE_LEGAL_ID);
    expect(readErrorA).toBeNull();
    expect(readA?.length).toBe(1);
  });

  it('Verifica RLS de Agenda Plazos', async () => {
    const caseIdA = SEED_DATA.CASE_LEGAL_ID;
    const orgAId = SEED_DATA.ORG_LEGAL_ID;

    // Employee A crea plazo
    const { error: agendaInsert } = await employeeALegal.client.from('agenda_plazos').insert({
      organization_id: orgAId,
      case_id: caseIdA,
      fecha: '2027-01-01',
      categoria: 'Vencimiento',
      titulo: 'Test Plazo RLS ' + randomUUID()
    });
    expect(agendaInsert).toBeNull();

    // Admin B no puede ver plazo
    const { data: bData } = await adminBInm.client.from('agenda_plazos').select('*').eq('organization_id', orgAId);
    expect(bData?.length).toBe(0);

    // Admin A puede ver plazo
    const { data: aData } = await adminALegal.client.from('agenda_plazos').select('*').eq('organization_id', orgAId);
    expect(aData?.length).toBeGreaterThan(0);
  });

  it('Verifica que un Employee no puede borrar ai_outputs pero Admin sí', async () => {
    const caseIdA = SEED_DATA.CASE_LEGAL_ID;
    const orgAId = SEED_DATA.ORG_LEGAL_ID;

    const aiOutputId = randomUUID();
    await serviceClient.from('ai_outputs').insert({
      id: aiOutputId,
      organization_id: orgAId,
      case_id: caseIdA,
      action: 'analysis',
      content: { test: true },
      model_used: 'test-model'
    });

    // Employee A intenta borrar
    await employeeALegal.client.from('ai_outputs').delete().eq('id', aiOutputId);

    // Validar que todavía existe
    const { data: checkAfterEmp } = await serviceClient.from('ai_outputs').select('*').eq('id', aiOutputId);
    expect(checkAfterEmp?.length).toBe(1);

    // Admin A intenta borrar
    const { error: adminDeleteError } = await adminALegal.client.from('ai_outputs').delete().eq('id', aiOutputId);
    expect(adminDeleteError).toBeNull();

    const { data: checkAfterAdmin } = await serviceClient.from('ai_outputs').select('*').eq('id', aiOutputId);
    expect(checkAfterAdmin?.length).toBe(0);
  });

  it('Verifica agent_messages RLS', async () => {
    const caseIdA = SEED_DATA.CASE_LEGAL_ID;
    const orgAId = SEED_DATA.ORG_LEGAL_ID;

    const { error: insertError } = await employeeALegal.client.from('agent_messages').insert({
      organization_id: orgAId,
      case_id: caseIdA,
      content: 'Mensaje de prueba',
      role: 'user'
    });
    expect(insertError).toBeNull();

    // Admin B from another org cannot see it
    const { data: bData } = await adminBInm.client.from('agent_messages').select('*').eq('case_id', caseIdA);
    expect(bData?.length).toBe(0);
  });
});
