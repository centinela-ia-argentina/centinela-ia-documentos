import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it, expect } from 'vitest';
// Guards the real route composition, not merely the isolated client panel.
// Runtime persistence/confirmation is additionally covered by authenticated E2E N.
it('case route exposes detection only as the reviewed manual action, never a mounting effect', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/app/expedientes/[id]/page.tsx'), 'utf8');
  expect(source).not.toContain('AutoMatchTrigger');
  expect(source).not.toContain('autoMarcarChecklistApi');
  expect(source).not.toMatch(/autoMarcarChecklist\s*\(/);
  expect(source).toContain('detect: autoMarcarChecklist');
  expect(source).toContain('canEdit={canUpdateCase(profile.role)}');
});
