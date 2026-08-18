import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials for RLS tests.');
}

const serviceClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

describe('Pruebas de Seguridad y RLS con JWT Reales', () => {
  let orgAId: string;
  let orgBId: string;
  
  let adminA: any;
  let employeeA: any;
  let auditorA: any;
  let employeeB: any;

  beforeAll(async () => {
    if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Estas pruebas destruyen datos y requieren un entorno local de Supabase. Setear ALLOW_DESTRUCTIVE_TESTS=true.');
    }
    if (supabaseUrl.includes('supabase.co')) {
      throw new Error('BLOCKED_BY_ENVIRONMENT: Detectada URL de Production. Abortando pruebas de seguridad.');
    }

    // 1. Crear organizaciones
    orgAId = randomUUID();
    orgBId = randomUUID();
    
    await serviceClient.from('organizations').insert([
      { id: orgAId, name: 'Org A', industry_type: 'general' },
      { id: orgBId, name: 'Org B', industry_type: 'general' }
    ]);

    // Helper para crear usuario
    const createUser = async (email: string, role: string, orgId: string) => {
      const password = 'TestPassword123!';
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;
      
      await serviceClient.from('profiles').update({
        organization_id: orgId,
        role: role,
        status: 'active',
      }).eq('id', userId);

      const { data: sessionData } = await serviceClient.auth.signInWithPassword({
        email,
        password,
      });

      return {
        id: userId,
        client: createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
          global: {
            headers: {
              Authorization: `Bearer ${sessionData.session?.access_token}`,
            },
          },
          auth: { persistSession: false },
        }),
      };
    };

    adminA = await createUser(`adminA_${randomUUID()}@test.com`, 'admin', orgAId);
    employeeA = await createUser(`empA_${randomUUID()}@test.com`, 'employee', orgAId);
    auditorA = await createUser(`audA_${randomUUID()}@test.com`, 'auditor', orgAId);
    employeeB = await createUser(`empB_${randomUUID()}@test.com`, 'employee', orgBId);
    
    // Additional roles requested by user
    const clientAssigned = await createUser(`client1_${randomUUID()}@test.com`, 'client', orgAId);
    const clientUnassigned = await createUser(`client2_${randomUUID()}@test.com`, 'client', orgAId);
    const inactiveUser = await createUser(`inactive_${randomUUID()}@test.com`, 'employee', orgAId);
    await serviceClient.from('profiles').update({ status: 'inactive' }).eq('id', inactiveUser.id);
  });

  afterAll(async () => {
    // Cleanup
    if (adminA) await serviceClient.auth.admin.deleteUser(adminA.id);
    if (employeeA) await serviceClient.auth.admin.deleteUser(employeeA.id);
    if (auditorA) await serviceClient.auth.admin.deleteUser(auditorA.id);
    if (employeeB) await serviceClient.auth.admin.deleteUser(employeeB.id);

    await serviceClient.from('organizations').delete().in('id', [orgAId, orgBId]);
  });

  it('Verifica Aislamiento Multi-Tenant en Expedientes', async () => {
    const caseIdA = randomUUID();
    // Admin A crea expediente
    const { error: insertError } = await adminA.client.from('cases').insert({
      id: caseIdA,
      organization_id: orgAId,
      title: 'Caso A',
      status: 'active',
      assigned_to: employeeA.id,
      created_by: adminA.id
    });
    expect(insertError).toBeNull();

    // Empleado B intenta leer el expediente A
    const { data: readB, error: readErrorB } = await employeeB.client.from('cases').select('*').eq('id', caseIdA);
    expect(readErrorB).toBeNull(); // No error, just empty array due to RLS
    expect(readB?.length).toBe(0);

    // Empleado A lee el expediente A
    const { data: readA, error: readErrorA } = await employeeA.client.from('cases').select('*').eq('id', caseIdA);
    expect(readErrorA).toBeNull();
    expect(readA?.length).toBe(1);
  });

  it('Verifica RLS de Agenda Plazos', async () => {
    const caseIdA = randomUUID();
    await serviceClient.from('cases').insert({
      id: caseIdA,
      organization_id: orgAId,
      title: 'Caso Agenda',
      status: 'active',
      created_by: adminA.id
    });

    // Employee A crea plazo
    const { error: agendaInsert } = await employeeA.client.from('agenda_plazos').insert({
      organization_id: orgAId,
      case_id: caseIdA,
      fecha: '2027-01-01',
      categoria: 'Vencimiento',
      titulo: 'Test Plazo'
    });
    expect(agendaInsert).toBeNull();

    // Employee B no puede ver plazo
    const { data: bData } = await employeeB.client.from('agenda_plazos').select('*');
    expect(bData?.length).toBe(0);

    // Auditor A puede ver plazo
    const { data: aData } = await auditorA.client.from('agenda_plazos').select('*');
    expect(aData?.length).toBeGreaterThan(0);
  });

  it('Verifica que un Employee no puede borrar ai_outputs pero Admin sí', async () => {
    const caseIdA = randomUUID();
    await serviceClient.from('cases').insert({
      id: caseIdA,
      organization_id: orgAId,
      title: 'Caso AI',
      status: 'active',
      created_by: adminA.id
    });

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
    const { error: empDeleteError } = await employeeA.client.from('ai_outputs').delete().eq('id', aiOutputId);
    // Delete with no rows affected doesn't throw error in Supabase JS, it just returns empty data
    // We must check if it was deleted
    const { data: checkAfterEmp } = await serviceClient.from('ai_outputs').select('*').eq('id', aiOutputId);
    expect(checkAfterEmp?.length).toBe(1); // Still exists

    // Admin A intenta borrar
    const { error: adminDeleteError } = await adminA.client.from('ai_outputs').delete().eq('id', aiOutputId);
    expect(adminDeleteError).toBeNull();

    const { data: checkAfterAdmin } = await serviceClient.from('ai_outputs').select('*').eq('id', aiOutputId);
    expect(checkAfterAdmin?.length).toBe(0); // Deleted
  });

  it('Verifica agent_messages RLS', async () => {
    const caseIdA = randomUUID();
    await serviceClient.from('cases').insert({
      id: caseIdA,
      organization_id: orgAId,
      title: 'Caso Agent',
      status: 'active',
      created_by: adminA.id
    });

    const { error: insertError } = await employeeA.client.from('agent_messages').insert({
      organization_id: orgAId,
      case_id: caseIdA,
      content: 'Mensaje de prueba',
      role: 'user'
    });
    expect(insertError).toBeNull();

    // Employee B from another org cannot see it
    const { data: bData } = await employeeB.client.from('agent_messages').select('*').eq('case_id', caseIdA);
    expect(bData?.length).toBe(0);
  });
});
