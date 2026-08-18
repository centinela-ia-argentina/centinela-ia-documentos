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

export const SEED_DATA = {
  ORG_LEGAL_ID: '11111111-1111-1111-1111-111111111111',
  ORG_INM_ID: '22222222-2222-2222-2222-222222222222',
  ADMIN_LEGAL_ID: 'aaaa1111-1111-1111-1111-111111111111',
  ADMIN_INM_ID: 'bbbb2222-2222-2222-2222-222222222222',
  EMPLOYEE_LEGAL_ID: 'eeee1111-1111-1111-1111-111111111111',
  CASE_LEGAL_ID: 'cccc1111-1111-1111-1111-111111111111',
  CASE_INM_ID: 'dddd2222-2222-2222-2222-222222222222',
  DOC_LEGAL_ID: 'ddcc1111-1111-1111-1111-111111111111',
};

export async function seedSupabase() {
  console.log('🌱 Seeding Supabase...');

  // 1. Orgs
  await supabaseAdmin.from('organizations').upsert([
    { id: SEED_DATA.ORG_LEGAL_ID, name: 'Estudio Legal Test', industry_type: 'legal' },
    { id: SEED_DATA.ORG_INM_ID, name: 'Inmobiliaria Test', industry_type: 'inmobiliaria' },
  ]);

  // 2. Auth Users
  const users = [
    { id: SEED_DATA.ADMIN_LEGAL_ID, email: 'admin.legal@test.com' },
    { id: SEED_DATA.ADMIN_INM_ID, email: 'admin.inm@test.com' },
    { id: SEED_DATA.EMPLOYEE_LEGAL_ID, email: 'emp.legal@test.com' }
  ];

  for (const u of users) {
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(u.id);
    if (!existingUser.user) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        id: u.id,
        email: u.email,
        password: 'password123',
        email_confirm: true,
      });
      if (error && !error.message.includes('already exists')) {
        console.error('Error creating user:', u.email, error);
      }
    }
  }

  // 3. Profiles
  await supabaseAdmin.from('profiles').upsert([
    { id: SEED_DATA.ADMIN_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'admin.legal@test.com', role: 'admin', status: 'active', full_name: 'Admin Legal' },
    { id: SEED_DATA.ADMIN_INM_ID, organization_id: SEED_DATA.ORG_INM_ID, email: 'admin.inm@test.com', role: 'admin', status: 'active', full_name: 'Admin Inmobiliaria' },
    { id: SEED_DATA.EMPLOYEE_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, email: 'emp.legal@test.com', role: 'employee', status: 'active', full_name: 'Employee Legal' }
  ]);

  // 4. Cases
  await supabaseAdmin.from('cases').upsert([
    { id: SEED_DATA.CASE_LEGAL_ID, organization_id: SEED_DATA.ORG_LEGAL_ID, title: 'Caso Legal 1', case_type: 'civil', status: 'active', created_by: SEED_DATA.ADMIN_LEGAL_ID },
    { id: SEED_DATA.CASE_INM_ID, organization_id: SEED_DATA.ORG_INM_ID, title: 'Propiedad 1', case_type: 'venta', status: 'active', created_by: SEED_DATA.ADMIN_INM_ID },
  ]);

  // 5. Documents (For RAG/RLS tests)
  await supabaseAdmin.from('documents').upsert([
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
  ]);

  // 6. Document Chunks (for RPC RAG tests)
  await supabaseAdmin.from('document_chunks').upsert([
    {
      id: 'chunk111-1111-1111-1111-111111111111',
      organization_id: SEED_DATA.ORG_LEGAL_ID,
      document_id: SEED_DATA.DOC_LEGAL_ID,
      chunk_text: 'Este es un fragmento de prueba para RAG en caso legal.',
      embedding: Array(768).fill(0.01) // dummy vector
    }
  ]);

  console.log('✅ Supabase seeded successfully.');
}

if (require.main === module) {
  seedSupabase().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
