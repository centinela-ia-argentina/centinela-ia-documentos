import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/ai/embeddings', () => ({
  generarEmbedding: vi.fn().mockResolvedValue({ values: [0.1, 0.2, 0.3] }),
}));

import { preguntarADocumentos } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';

describe('C-M3-J-003 & C-M3-J-006: Search & RAG citation filtering and negative queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'prof-1', organization_id: 'org-1', role: 'admin' } as any,
    });
  });

  it('negative response: returns empty sources array without irrelevant sources', async () => {
    const mockMatches = [
      { document_id: 'doc-1', content: 'Contrato de locación firmado en 2023.', similarity: 0.60 },
      { document_id: 'doc-2', content: 'Recibo de expensas.', similarity: 0.50 },
    ];

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { industry_type: 'legal' } }),
              }),
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'doc-1', file_name: 'Contrato.pdf' },
                  { id: 'doc-2', file_name: 'Expensas.pdf' },
                ],
              }),
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
    };

    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);

    process.env.GEMINI_API_KEY = 'test-key';

    // Model returns negative response
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'La información solicitada no surge de los documentos disponibles.' }],
            },
          },
        ],
      }),
    } as any);

    const res = await preguntarADocumentos('¿Qué penalidad por mora se acordó?');
    expect(res.ok).toBe(true);
    expect(res.respuesta).toContain('no surge de los documentos');
    // Irrelevant sources must NOT be cited or returned
    expect(res.fuentes).toEqual([]);
  });

  it('positive response: returns only sources cited in bracket format [n]', async () => {
    const mockMatches = [
      { document_id: 'doc-1', content: 'La tasa de interés por mora es del 5% mensual.', similarity: 0.75 },
      { document_id: 'doc-2', content: 'Texto irrelevante de otro comprobante.', similarity: 0.45 },
    ];

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { industry_type: 'legal' } }),
              }),
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'doc-1', file_name: 'Contrato.pdf' },
                  { id: 'doc-2', file_name: 'Comprobante.pdf' },
                ],
              }),
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
    };

    vi.mocked(createClient).mockResolvedValue(supabaseMock as any);

    process.env.GEMINI_API_KEY = 'test-key';

    // Model answers citing only [1]
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'La tasa por mora convenida es del 5% mensual [1].' }],
            },
          },
        ],
      }),
    } as any);

    const res = await preguntarADocumentos('¿Cuál es la tasa de mora?');
    expect(res.ok).toBe(true);
    expect(res.fuentes?.length).toBe(1);
    expect(res.fuentes?.[0].documentId).toBe('doc-1');
    expect(res.fuentes?.[0].fileName).toBe('Contrato.pdf');
  });
});
