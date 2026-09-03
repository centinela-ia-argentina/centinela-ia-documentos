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

import ReportsPage from './page';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { redirect } from 'next/navigation';

describe('T-AUD-P2-002: Paginación server-side de auditoría para datasets superiores a 80 registros', () => {
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
              // Include identical timestamps to verify deterministic secondary ordering
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

  it('1. Orden determinístico con timestamps repetidos: aplica order por created_at y secundario por id', async () => {
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

  it('2. Página 1 solicita el rango exacto 0 a 49 para un dataset de 120 registros sin truncar en 80', async () => {
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: '1',
      }),
    });

    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });

  it('3. Página 2 solicita el rango exacto 50 a 99 permitiendo acceder a registros más allá de 80', async () => {
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: '2',
      }),
    });

    expect(mockRange).toHaveBeenCalledWith(50, 99);
  });

  it('4. Página 3 solicita el rango exacto 100 a 149 cubriendo la totalidad de los 120 registros', async () => {
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: '3',
      }),
    });

    expect(mockRange).toHaveBeenCalledWith(100, 149);
  });

  it('5. Parámetros inválidos (page=0, page negativa, page no numérica): normaliza automáticamente a página 1', async () => {
    // page = 0
    mockRange.mockClear();
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: '0',
      }),
    });
    expect(mockRange).toHaveBeenCalledWith(0, 49);

    // page negativa (-3)
    mockRange.mockClear();
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: '-3',
      }),
    });
    expect(mockRange).toHaveBeenCalledWith(0, 49);

    // page no numérica ('abc')
    mockRange.mockClear();
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'todos',
        pagina: 'abc',
      }),
    });
    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });

  it('6. Página superior al total: redirige a la última página válida conservando el filtro activo', async () => {
    // Con 120 registros y PAGE_SIZE=50, totalPages = 3.
    // Pedir pagina 10 debe redirigir a pagina=3
    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'expedientes',
        pagina: '10',
      }),
    });

    expect(redirect).toHaveBeenCalledWith('/reportes?vista=auditoria&tipo=expedientes&pagina=3');
  });

  it('7. Filtro que devuelve cero resultados: no redirige y consulta rango 0 a 49 sin errores', async () => {
    totalCount = 0;
    mockRange.mockClear();

    await ReportsPage({
      searchParams: Promise.resolve({
        vista: 'auditoria',
        tipo: 'invitaciones',
        pagina: '1',
      }),
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });

  it('8. Aplica el filtro server-side mediante or() al consultar la auditoría de documentos', async () => {
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
