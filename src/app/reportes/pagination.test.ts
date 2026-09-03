import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import ReportsPage, { parseStrictPositiveInteger } from './page';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { redirect } from 'next/navigation';

describe('T-AUD-P2-002: Validación estricta de paginación server-side en auditoría', () => {
  describe('A. Función parseStrictPositiveInteger', () => {
    it('acepta enteros positivos decimales seguros', () => {
      expect(parseStrictPositiveInteger('1')).toBe(1);
      expect(parseStrictPositiveInteger('50')).toBe(50);
      expect(parseStrictPositiveInteger(10)).toBe(10);
      expect(parseStrictPositiveInteger(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('rechaza 0', () => {
      expect(parseStrictPositiveInteger('0')).toBeNull();
      expect(parseStrictPositiveInteger(0)).toBeNull();
    });

    it('rechaza números negativos', () => {
      expect(parseStrictPositiveInteger('-1')).toBeNull();
      expect(parseStrictPositiveInteger('-50')).toBeNull();
      expect(parseStrictPositiveInteger(-3)).toBeNull();
    });

    it('rechaza cadenas no numéricas ("abc")', () => {
      expect(parseStrictPositiveInteger('abc')).toBeNull();
    });

    it('rechaza cadenas alfanuméricas ("2abc")', () => {
      expect(parseStrictPositiveInteger('2abc')).toBeNull();
      expect(parseStrictPositiveInteger('123xyz')).toBeNull();
    });

    it('rechaza decimales ("1.5")', () => {
      expect(parseStrictPositiveInteger('1.5')).toBeNull();
      expect(parseStrictPositiveInteger('3.14')).toBeNull();
    });

    it('rechaza espacios vacíos y strings en blanco', () => {
      expect(parseStrictPositiveInteger('   ')).toBeNull();
      expect(parseStrictPositiveInteger('')).toBeNull();
      expect(parseStrictPositiveInteger(null)).toBeNull();
      expect(parseStrictPositiveInteger(undefined)).toBeNull();
    });

    it('rechaza enteros que superan Number.MAX_SAFE_INTEGER', () => {
      expect(parseStrictPositiveInteger('99999999999999999999999999999999')).toBeNull();
      expect(parseStrictPositiveInteger(String(Number.MAX_SAFE_INTEGER + 1000))).toBeNull();
    });
  });

  describe('B. Comportamiento en ReportsPage (vista auditoría)', () => {
    const mockRange = vi.fn();
    const mockOr = vi.fn();
    const mockOrder = vi.fn();
    let totalCount = 120;

    beforeEach(() => {
      vi.clearAllMocks();
      totalCount = 120;

      vi.mocked(getUserProfile).mockResolvedValue({
        user: { id: 'admin-1' },
        profile: {
          id: 'admin-1',
          organization_id: 'org-test',
          role: 'admin',
        },
      } as any);

      const createQueryProxy = (table?: string): any => {
        const target: any = {
          then: (resolve: any) =>
            resolve({
              data: totalCount === 0 ? [] : Array.from({ length: 50 }, (_, i) => ({
                id: `log-${i + 1}`,
                organization_id: 'org-test',
                user_id: 'admin-1',
                action: 'case_created',
                resource_type: 'case',
                resource_id: `case-${i + 1}`,
                metadata: {},
                created_at: '2026-09-02T12:00:00.000Z',
              })),
              count: totalCount,
              error: null,
            }),
        };

        return new Proxy(target, {
          get: (_t, prop) => {
            if (prop === 'then') return target.then;
            if (prop === 'maybeSingle') {
              return () => Promise.resolve({ data: { industry_type: 'legal' }, error: null });
            }
            if (prop === 'single') {
              return () => Promise.resolve({ data: { industry_type: 'legal' }, error: null });
            }
            if (prop === 'order') {
              return (...args: any[]) => {
                mockOrder(...args);
                return createQueryProxy(table);
              };
            }
            if (prop === 'range') {
              return (...args: any[]) => {
                mockRange(...args);
                return createQueryProxy(table);
              };
            }
            if (prop === 'or') {
              return (...args: any[]) => {
                mockOr(...args);
                return createQueryProxy(table);
              };
            }
            return () => createQueryProxy(table);
          },
        });
      };

      vi.mocked(createClient).mockResolvedValue({
        from: (table: string) => createQueryProxy(table),
      } as any);
    });

    it('1. Orden determinístico: aplica order por created_at y secundario por id', async () => {
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'todos',
          pagina: '1',
        }),
      });

      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockOrder).toHaveBeenCalledWith('id', { ascending: false });
      expect(mockRange).toHaveBeenCalledWith(0, 49);
    });

    it('2. Página válida 1: rango 0 a 49', async () => {
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'todos',
          pagina: '1',
        }),
      });

      expect(mockRange).toHaveBeenCalledWith(0, 49);
    });

    it('3. Página válida 2: rango 50 a 99', async () => {
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'todos',
          pagina: '2',
        }),
      });

      expect(mockRange).toHaveBeenCalledWith(50, 99);
    });

    it('4. Parámetros inválidos (0, negativos, abc, 2abc, 1.5, espacios): redirige a pagina=1 y NO ejecuta range', async () => {
      const invalidInputs = ['0', '-5', 'abc', '2abc', '1.5', '   '];

      for (const input of invalidInputs) {
        vi.clearAllMocks();
        await ReportsPage({
          searchParams: Promise.resolve({
            vista: 'auditoria',
            tipo: 'documentos',
            pagina: input,
          }),
        });

        expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=documentos&pagina=1');
        expect(mockRange).not.toHaveBeenCalled();
      }
    });

    it('5. Entero superior a MAX_SAFE_INTEGER: redirige a pagina=1 y NO ejecuta range', async () => {
      vi.clearAllMocks();
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'ia',
          pagina: '99999999999999999999999999999999',
        }),
      });

      expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=ia&pagina=1');
      expect(mockRange).not.toHaveBeenCalled();
    });

    it('6. Number.MAX_SAFE_INTEGER o página desbordada (> totalPages): redirige a totalPages y NO ejecuta range', async () => {
      // 120 registros -> totalPages = 3
      // Probar página 10
      vi.clearAllMocks();
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'expedientes',
          pagina: '10',
        }),
      });

      expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=expedientes&pagina=3');
      expect(mockRange).not.toHaveBeenCalled();

      // Probar Number.MAX_SAFE_INTEGER
      vi.clearAllMocks();
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'expedientes',
          pagina: String(Number.MAX_SAFE_INTEGER),
        }),
      });

      expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=expedientes&pagina=3');
      expect(mockRange).not.toHaveBeenCalled();
    });

    it('7. Cero resultados: con pagina=1 no redirige y consulta range(0, 49); con pagina=2 redirige a pagina=1', async () => {
      totalCount = 0;

      // pagina=1 con 0 resultados: ejecuta range, no redirige
      vi.clearAllMocks();
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'invitaciones',
          pagina: '1',
        }),
      });

      expect(redirect).not.toHaveBeenCalled();
      expect(mockRange).toHaveBeenCalledWith(0, 49);

      // pagina=2 con 0 resultados: redirige a pagina=1 sin ejecutar range
      vi.clearAllMocks();
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'invitaciones',
          pagina: '2',
        }),
      });

      expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=invitaciones&pagina=1');
      expect(mockRange).not.toHaveBeenCalled();
    });

    it('8. Preservación estricta del filtro al aplicar or() server-side', async () => {
      await ReportsPage({
        searchParams: Promise.resolve({
          vista: 'auditoria',
          tipo: 'documentos',
          pagina: '1',
        }),
      });

      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('resource_type.eq.document'));
      expect(mockRange).toHaveBeenCalledWith(0, 49);
    });
  });
});
