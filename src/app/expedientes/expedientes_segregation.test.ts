import { describe, it, expect, vi, beforeEach } from 'vitest';
import { caseTypesByIndustry } from '@/lib/industries/caseConfig';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import CasesPage from './page';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { createClient } from '@/lib/supabase/server';

describe('Expedientes Listing Segregation: Canonical case types filtering', () => {
  let inFiltersApplied: Array<{ column: string; values: any[] }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    inFiltersApplied = [];

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'prof-1', organization_id: 'org-1', role: 'admin' } as any,
    });
  });

  function createMockSupabase(casesData: any[] = []) {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation((col: string, vals: any[]) => {
        inFiltersApplied.push({ column: col, values: vals });
        return chain;
      }),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: casesData,
        count: casesData.length,
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
      }),
    };

    return {
      from: vi.fn((table: string) => chain),
    };
  }

  it('para organización Jurídico (legal): incluye canónicos legales y excluye tipos de inmobiliaria/escribania', async () => {
    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue('legal');
    const mockSupabase = createMockSupabase([]);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await CasesPage({ searchParams: Promise.resolve({}) });

    const caseTypeFilter = inFiltersApplied.find((f) => f.column === 'case_type');
    expect(caseTypeFilter).toBeDefined();
    expect(caseTypeFilter?.values).toEqual(caseTypesByIndustry.legal);

    // Jurídico excludes Compraventa / Alquiler / Escritura
    expect(caseTypeFilter?.values).not.toContain('Compraventa de inmueble');
    expect(caseTypeFilter?.values).not.toContain('Alquiler');
    expect(caseTypeFilter?.values).not.toContain('Escritura');
    expect(caseTypeFilter?.values).toContain('Demanda');
    expect(caseTypeFilter?.values).toContain('Caso jurídico');
  });

  it('para organización Escribanía: incluye canónicos de escribanía y excluye tipos ajenos', async () => {
    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue('escribania');
    const mockSupabase = createMockSupabase([]);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await CasesPage({ searchParams: Promise.resolve({}) });

    const caseTypeFilter = inFiltersApplied.find((f) => f.column === 'case_type');
    expect(caseTypeFilter).toBeDefined();
    expect(caseTypeFilter?.values).toEqual(caseTypesByIndustry.escribania);

    // Escribanía excludes Demanda / Alquiler
    expect(caseTypeFilter?.values).not.toContain('Demanda');
    expect(caseTypeFilter?.values).not.toContain('Alquiler');
    expect(caseTypeFilter?.values).toContain('Escritura');
    expect(caseTypeFilter?.values).toContain('Poder');
  });

  it('para organización Inmobiliaria: incluye canónicos inmobiliarios y excluye tipos ajenos', async () => {
    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue('inmobiliaria');
    const mockSupabase = createMockSupabase([]);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await CasesPage({ searchParams: Promise.resolve({}) });

    const caseTypeFilter = inFiltersApplied.find((f) => f.column === 'case_type');
    expect(caseTypeFilter).toBeDefined();
    expect(caseTypeFilter?.values).toEqual(caseTypesByIndustry.inmobiliaria);

    // Inmobiliaria excludes Demanda / Escritura
    expect(caseTypeFilter?.values).not.toContain('Demanda');
    expect(caseTypeFilter?.values).not.toContain('Escritura');
    expect(caseTypeFilter?.values).toContain('Compraventa de inmueble');
    expect(caseTypeFilter?.values).toContain('Alquiler');
  });
});
