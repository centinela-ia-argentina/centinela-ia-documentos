import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

import { buscarEntidadesOperativas } from './actions';
import { escaparFiltroPostgrest } from './helpers';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';

describe('buscarEntidadesOperativas - Sanitización, Caracteres Reservados y Seguridad Multi-Tenant', () => {
  let mockCasesOr: any;
  let mockCasesEq: any;
  let mockDocsOr: any;
  let mockDocsEq: any;
  let capturedCasesFilters: { eqOrg?: string; orFilter?: string } = {};
  let capturedDocsFilters: { eqOrg?: string; orFilter?: string } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    capturedCasesFilters = {};
    capturedDocsFilters = {};

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'prof-1', organization_id: 'org-notarial-1', role: 'admin' } as any,
    });

    mockCasesOr = vi.fn().mockImplementation((filter: string) => {
      capturedCasesFilters.orFilter = filter;
      return {
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'case-1', title: 'Legajo Prueba', client_name: 'Pérez', case_type: 'Compraventa', status: 'active' }],
          error: null,
        }),
      };
    });

    mockCasesEq = vi.fn().mockImplementation((col: string, val: string) => {
      if (col === 'organization_id') capturedCasesFilters.eqOrg = val;
      return { or: mockCasesOr };
    });

    mockDocsOr = vi.fn().mockImplementation((filter: string) => {
      capturedDocsFilters.orFilter = filter;
      return {
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'doc-1', file_name: 'escritura.pdf', document_type: 'escritura', case_id: 'case-1' }],
          error: null,
        }),
      };
    });

    mockDocsEq = vi.fn().mockImplementation((col: string, val: string) => {
      if (col === 'organization_id') capturedDocsFilters.eqOrg = val;
      return { or: mockDocsOr };
    });

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({ eq: mockCasesEq }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({ eq: mockDocsEq }),
          };
        }
        return {} as any;
      }),
    } as any);
  });

  describe('escaparFiltroPostgrest helper', () => {
    it('1. escapa comas sin romper delimitador postgrest cuando se usa entre comillas', () => {
      const input = 'Gómez, Juan';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('Gómez, Juan');
    });

    it('2. escapa comodín % para evitar inyección en ILIKE', () => {
      const input = '100% libre';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('100\\% libre');
    });

    it('3. escapa comodín _ para evitar comodín de un solo caracter en ILIKE', () => {
      const input = 'doc_final';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('doc\\_final');
    });

    it('4. preserva paréntesis dentro del literal entre comillas', () => {
      const input = 'Borrador (CABA)';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('Borrador (CABA)');
    });

    it('5. preserva puntos literales dentro de las comillas', () => {
      const input = 'Empresa S.A.';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('Empresa S.A.');
    });

    it('6. escapa comillas dobles internas para no romper el envoltorio PostgREST', () => {
      const input = 'Legajo "Urgente"';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('Legajo \\"Urgente\\"');
    });

    it('7. texto normal permanece inalterado', () => {
      const input = 'Martínez';
      const output = escaparFiltroPostgrest(input);
      expect(output).toBe('Martínez');
    });
  });

  describe('buscarEntidadesOperativas execution and filters', () => {
    it('8. búsqueda con coma se encierra entre comillas dobles y no rompe .or(...)', async () => {
      const res = await buscarEntidadesOperativas('Gómez, Juan');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%Gómez, Juan%"');
      expect(capturedCasesFilters.orFilter).toContain('client_name.ilike."%Gómez, Juan%"');
      expect(capturedDocsFilters.orFilter).toContain('file_name.ilike."%Gómez, Juan%"');
    });

    it('9. búsqueda con % escapa el caracter en el query', async () => {
      const res = await buscarEntidadesOperativas('tasa 50%');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%tasa 50\\%%"');
    });

    it('10. búsqueda con _ escapa el caracter en el query', async () => {
      const res = await buscarEntidadesOperativas('escritura_01');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%escritura\\_01%"');
    });

    it('11. búsqueda con paréntesis y puntos no rompe la sintaxis', async () => {
      const res = await buscarEntidadesOperativas('Sociedad Anónima (S.A.)');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%Sociedad Anónima (S.A.)%"');
    });

    it('12. búsqueda con comillas dobles escapa las comillas internas', async () => {
      const res = await buscarEntidadesOperativas('Poder "Especial"');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%Poder \\"Especial\\"%"');
    });

    it('13. búsqueda con texto normal funciona limpiamente', async () => {
      const res = await buscarEntidadesOperativas('Donación');
      expect(res.ok).toBe(true);
      expect(capturedCasesFilters.orFilter).toContain('title.ilike."%Donación%"');
      expect(res.legajos).toHaveLength(1);
      expect(res.documentos).toHaveLength(1);
    });

    it('14. aislamiento cross-org: la consulta siempre restringe estrictamente por organization_id del usuario autenticado', async () => {
      await buscarEntidadesOperativas('Test Cross Org');
      expect(capturedCasesFilters.eqOrg).toBe('org-notarial-1');
      expect(capturedDocsFilters.eqOrg).toBe('org-notarial-1');

      // Si cambia de organización en la sesión
      vi.mocked(getUserProfile).mockResolvedValueOnce({
        user: { id: 'user-2' } as any,
        profile: { id: 'prof-2', organization_id: 'org-inmobiliaria-99', role: 'admin' } as any,
      });

      await buscarEntidadesOperativas('Test Cross Org');
      expect(capturedCasesFilters.eqOrg).toBe('org-inmobiliaria-99');
      expect(capturedDocsFilters.eqOrg).toBe('org-inmobiliaria-99');
    });

    it('15. manejo explícito de casesRes.error no devuelve silenciosamente listas vacías', async () => {
      mockCasesOr.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'syntax error at or near "," in postgrest filter', code: 'PGRST100' },
        }),
      });

      const res = await buscarEntidadesOperativas('Gómez, Juan');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Error al buscar legajos: syntax error at or near ","');
      expect(res.legajos).toEqual([]);
    });

    it('16. manejo explícito de docsRes.error no devuelve silenciosamente listas vacías', async () => {
      mockDocsOr.mockReturnValueOnce({
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'connection timeout querying documents', code: 'PGRST500' },
        }),
      });

      const res = await buscarEntidadesOperativas('Boleto compraventa');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Error al buscar documentos: connection timeout');
      expect(res.documentos).toEqual([]);
    });
  });
});
