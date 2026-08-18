const fs = require('fs');
const files = [
  'src/app/documentos/actions.ts',
  'src/app/documentos/subir/UploadClient.tsx',
  'tests/e2e/juridico.spec.ts',
  'tests/security/rls.test.ts',
  'tests/setup/seed-supabase.ts'
];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, content.replace(/[ \t]+$/gm, ''));
}
