import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Reportes: segregación vertical de operaciones', () => {
  it('proyecta case_type en las consultas usadas por General y Gestión', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/reportes/page.tsx'),
      'utf8'
    );

    const projections = source.match(
      /\.select\('id, status, case_type'\)/g
    );

    expect(projections).toHaveLength(2);
  });
});