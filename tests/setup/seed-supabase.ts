import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const validateUuid = (uuid: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);

export const SEED_DATA = {
  ORG_LEGAL_ID: '11111111-1111-1111-1111-111111111111',
  ORG_INM_ID: '22222222-2222-2222-2222-222222222222',
  ADMIN_LEGAL_ID: 'aaaa1111-1111-1111-1111-111111111111',
  EMPLOYEE_LEGAL_ID: 'eeee1111-1111-1111-1111-111111111111',
  AUDITOR_LEGAL_ID: 'ffff1111-1111-1111-1111-111111111111',
  CLIENT_ASSIGNED_ID: 'c1a11111-1111-1111-1111-111111111111',
  CLIENT_UNASSIGNED_ID: 'c1b11111-1111-1111-1111-111111111111',
  INACTIVE_LEGAL_ID: '44444444-4444-4444-4444-444444444444',
  ADMIN_INM_ID: 'bbbb2222-2222-2222-2222-222222222222',
  CASE_LEGAL_ID: 'cccc1111-1111-1111-1111-111111111111',
  CASE_INM_ID: 'dddd2222-2222-2222-2222-222222222222',
  DOC_LEGAL_ID: 'ddcc1111-1111-1111-1111-111111111111',
  CHUNK_ID: '33333333-3333-3333-3333-333333333333'
};

// Validar que todos sean UUID válidos
for (const [k, v] of Object.entries(SEED_DATA)) {
  if (!validateUuid(v)) throw new Error(`Invalid UUID in SEED_DATA for ${k}: ${v}`);
}

async function throwOnError(promise: any, entity: string) {
  const result = await promise;
  if (result.error) {
    throw new Error(`Error in ${entity}: ${JSON.stringify(result.error)}`);
  }
  return result;
}

export async function seedSupabase() {
  console.log('🌱 Seeding Supabase...');
  let hasError = false;

  try {
    // 1. Orgs
    await throwOnError(supabaseAdmin.from('organizations').upsert([
      { id: SEED_DATA.ORG_LEGAL_ID, name: 'Estudio Legal Test', industry_type: 'legal' },
      { id: SEED_DATA.ORG_INM_ID, name: 'Inmobiliaria Test', industry_type: 'inmobiliaria' },
    ]), 'organizations');

    // 2. Auth Users
    const users = [
      { id: SEED_DATA.ADMIN_LEGAL_ID, email: 'admin.legal@test.com' },
      { id: SEED_DATA.EMPLOYEE_LEGAL_ID, email: 'emp.legal@test.com' },
      { id: SEED_DATA.AUDITOR_LEGAL_ID, email: 'auditor.legal@test.com' },
      { id: SEED_DATA.CLIENT_ASSIGNED_ID, email: 'client.assigned@test.com' },
      { id: SEED_DATA.CLIENT_UNASSIGNED_ID, email: 'client.unassigned@test.com' },
      { id: SEED_DATA.INACTIVE_LEGAL_ID, email: 'inactive.legal@test.com' },
      { id: SEED_DATA.ADMIN_INM_ID, email: 'admin.inm@test.com' }
    ];

    for (const u of users) {
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(u.id);
      if (!existingUser?.user) {
        const { error } = await supabaseAdmin.auth.admin.createUser({
          id: u.id,
          email: u.email,
          password: 'password123',
          email_confirm: true,
        });
        if (error && !error.message.includes('already exists')) {
          throw new Error(`Error creating Auth user ${u.email}: ${error.message}`);
        }
      }
    }

    // 3. Profiles
    await throwOnError(supabaseAdmin.from('profiles').upsert([
      { id: SEED_DATA.ADMIN_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'admin.legal@test.com', role: 'admin', status: 'active', full_name: 'Admin Legal' },
      { id: SEED_DATA.EMPLOYEE_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'emp.legal@test.com', role: 'employee', status: 'active', full_name: 'Employee Legal' },
      { id: SEED_DATA.AUDITOR_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'auditor.legal@test.com', role: 'auditor', status: 'active', full_name: 'Auditor Legal' },
      { id: SEED_DATA.CLIENT_ASSIGNED_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'client.assigned@test.com', role: 'client', status: 'active', full_name: 'Client Assigned' },
      { id: SEED_DATA.CLIENT_UNASSIGNED_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'client.unassigned@test.com', role: 'client', status: 'active', full_name: 'Client Unassigned' },
      { id: SEED_DATA.INACTIVE_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'inactive.legal@test.com', role: 'employee', status: 'inactive', full_name: 'Inactive Legal' },
      { id: SEED_DATA.ADMIN_INM_ID, organization_id: SEED_DATA.ORG_INM_ID, email: 'admin.inm@test.com', role: 'admin', status: 'active', full_name: 'Admin Inm' }
    ]), 'profiles');

    // 4. Cases
    await throwOnError(supabaseAdmin.from('cases').upsert([
      { id: SEED_DATA.CASE_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, title: 'Caso Legal 1', case_type: 'civil', status: 'active', created_by: SEED_DATA.ADMIN_LEGAL_ID, assigned_to: SEED_DATA.CLIENT_ASSIGNED_ID },
      { id: SEED_DATA.CASE_INM_ID, organization_id: SEED_DATA.ORG_INM_ID, title: 'Propiedad 1', case_type: 'venta', status: 'active', created_by: SEED_DATA.ADMIN_INM_ID, assigned_to: null },
    ]), 'cases');

    // 5. Documents (For RAG/RLS tests)
    await throwOnError(supabaseAdmin.from('documents').upsert([
      {
        id: SEED_DATA.DOC_LEGAL_ID,
        organization_id: SEED_DATA.ORG_LEGAL_ID,
        case_id: SEED_DATA.CASE_LEGAL_ID,
        file_name: 'prueba.pdf',
        file_path: `${SEED_DATA.ORG_LEGAL_ID}/general/prueba.pdf`,
        file_size: 1000,
        file_mime_type: 'application/pdf',
        file_hash: 'mockhash123',
        uploaded_by: SEED_DATA.ADMIN_LEGAL_ID
      }
    ]), 'documents');

    // 6. Document Chunks (for RPC RAG tests)
    await throwOnError(supabaseAdmin.from('document_chunks').upsert([
      {
        id: SEED_DATA.CHUNK_ID,
        organization_id: SEED_DATA.ORG_LEGAL_ID,
        document_id: SEED_DATA.DOC_LEGAL_ID,
        chunk_index: 0,
        content: 'Este es un fragmento de prueba para RAG en caso legal.',
        embedding: Array(768).fill(0.01)
      }
    ]), 'chunks');

    console.log('✅ Supabase seeded successfully.');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedSupabase().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
