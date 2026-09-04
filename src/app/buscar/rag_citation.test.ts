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
import {
  parseAndAlignRagResponse,
  esRespuestaNegativa,
  RESPUETA_NEGATIVA_ESTANDAR,
  normalizarMarkdownTexto,
} from '@/lib/ai/ragAlignment';

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
          const docData = {
            data: [
              { id: 'doc-1', file_name: 'Contrato.pdf' },
              { id: 'doc-2', file_name: 'Expensas.pdf' },
            ],
          };
          const queryMock: any = {
            in: vi.fn().mockImplementation(() => queryMock),
            eq: vi.fn().mockImplementation(() => queryMock),
            then: (resolve: any) => resolve(docData),
          };
          return {
            select: vi.fn().mockReturnValue(queryMock),
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
          const docData = {
            data: [
              { id: 'doc-1', file_name: 'Contrato.pdf' },
              { id: 'doc-2', file_name: 'Comprobante.pdf' },
            ],
          };
          const queryMock: any = {
            in: vi.fn().mockImplementation(() => queryMock),
            eq: vi.fn().mockImplementation(() => queryMock),
            then: (resolve: any) => resolve(docData),
          };
          return {
            select: vi.fn().mockReturnValue(queryMock),
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

  describe('Point 2, 3 & 4: Exact citation renumbering and robust evidence detection', () => {
    const mockSources = [
      { documentId: 'd1', fileName: 'Doc1.pdf', fragmento: 'Fragmento 1' },
      { documentId: 'd2', fileName: 'Doc2.pdf', fragmento: 'Fragmento 2' },
      { documentId: 'd3', fileName: 'Doc3.pdf', fragmento: 'Fragmento 3' },
    ];

    it('renumbers [2] to [1] and places source 2 at index 0 when only source 2 is cited', () => {
      const raw = 'La cláusula de rescisión figura en el instrumento [2].';
      const aligned = parseAndAlignRagResponse(raw, mockSources);

      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.respuesta).toBe('La cláusula de rescisión figura en el instrumento [1].');
      expect(aligned.fuentes).toHaveLength(1);
      expect(aligned.fuentes[0].documentId).toBe('d2');
      expect(aligned.fuentes[0].fileName).toBe('Doc2.pdf');
    });

    it('handles multiple and out-of-order citations ([3] and [1]) renumbering sequentially', () => {
      const raw = 'Según la pericia [3], los daños ascendieron a tal monto; ratificado por la carta documento [1].';
      const aligned = parseAndAlignRagResponse(raw, mockSources);

      expect(aligned.hasEvidence).toBe(true);
      // [3] was encountered first -> becomes [1] (pointing to d3)
      // [1] was encountered second -> becomes [2] (pointing to d1)
      expect(aligned.respuesta).toBe('Según la pericia [1], los daños ascendieron a tal monto; ratificado por la carta documento [2].');
      expect(aligned.fuentes).toHaveLength(2);
      expect(aligned.fuentes[0].documentId).toBe('d3');
      expect(aligned.fuentes[1].documentId).toBe('d1');
    });

    it('handles repeated citations cleanly ([2] ... [2]) without duplicating sources', () => {
      const raw = 'En la fecha [2] se notificó y en la misma foja [2] consta el sello.';
      const aligned = parseAndAlignRagResponse(raw, mockSources);

      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.respuesta).toBe('En la fecha [1] se notificó y en la misma foja [1] consta el sello.');
      expect(aligned.fuentes).toHaveLength(1);
      expect(aligned.fuentes[0].documentId).toBe('d2');
    });

    it('discards out-of-range citations ([99])', () => {
      const raw = 'Dato inventado [99] con fuente inexistente.';
      const aligned = parseAndAlignRagResponse(raw, mockSources);

      // No valid citations in range 1..3
      expect(aligned.fuentes).toEqual([]);
      expect(aligned.respuesta).not.toContain('[99]');
    });

    it('returns empty sources array for positive answers without citations (no fallback to sources[0])', () => {
      const raw = 'El demandado fue condenado al pago de las costas.';
      const aligned = parseAndAlignRagResponse(raw, mockSources);

      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.fuentes).toEqual([]);
    });

    it('detects negative queries across all required patterns and rejects citations/sources', () => {
      const negativePhrases = [
        'no puedo determinarlo con los documentos provistos [1].',
        'no hay evidencia suficiente para afirmar el pago [2].',
        'el dato no está disponible en las fojas agregadas.',
        'no se menciona el domicilio denunciado.',
        'no surge información sobre la mora.',
        'no consta la fecha de recepción.',
        'no se desprende de la documentación.',
        'sin información sobre el titular.',
        'información no disponible.',
      ];

      for (const phrase of negativePhrases) {
        expect(esRespuestaNegativa(phrase)).toBe(true);
        const aligned = parseAndAlignRagResponse(phrase, mockSources);
        expect(aligned.hasEvidence).toBe(false);
        expect(aligned.fuentes).toEqual([]);
        expect(aligned.respuesta).not.toContain('[1]');
        expect(aligned.respuesta).not.toContain('[2]');
      }
    });

    it('handles empty or whitespace-only response safely', () => {
      const aligned = parseAndAlignRagResponse('   ', mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
      expect(aligned.respuesta).toBeDefined();
    });

    it('parses structured JSON output when provided by model', () => {
      const jsonPositive = JSON.stringify({
        answer: 'El contrato fija prórroga de jurisdicción [2].',
        hasEvidence: true,
        citedSourceIndexes: [2],
      });
      const alignedPos = parseAndAlignRagResponse(jsonPositive, mockSources);
      expect(alignedPos.hasEvidence).toBe(true);
      expect(alignedPos.respuesta).toBe('El contrato fija prórroga de jurisdicción [1].');
      expect(alignedPos.fuentes).toHaveLength(1);
      expect(alignedPos.fuentes[0].documentId).toBe('d2');

      const jsonNegative = JSON.stringify({
        answer: 'No surge fecha de cancelación de la hipoteca.',
        hasEvidence: false,
        citedSourceIndexes: [1],
      });
      const alignedNeg = parseAndAlignRagResponse(jsonNegative, mockSources);
      expect(alignedNeg.hasEvidence).toBe(false);
      expect(alignedNeg.fuentes).toEqual([]);
    });

    it('JSON inválido que contiene [1] -> no devuelve fuentes y falla cerrado', () => {
      const invalidJson = '{"answer": "Incompleto... [1]';
      const aligned = parseAndAlignRagResponse(invalidJson, mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
      expect(aligned.respuesta).toContain('No se pudo procesar la respuesta estructurada');
    });

    it('bloque ```json roto -> falla cerrado', () => {
      const brokenBlock = '```json\n{"answer": "roto",\n```';
      const aligned = parseAndAlignRagResponse(brokenBlock, mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
    });

    it('JSON sin hasEvidence -> falla cerrado', () => {
      const missingField = JSON.stringify({
        answer: 'Dato sin bandera de evidencia [1].',
        citedSourceIndexes: [1],
      });
      const aligned = parseAndAlignRagResponse(missingField, mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
    });

    it('citedSourceIndexes contiene [1, 2] pero el texto solo cita [1] -> fuentes contiene solo la 1, texto queda [1]', () => {
      const json = JSON.stringify({
        answer: 'Solo se respalda el hecho con el documento [1].',
        hasEvidence: true,
        citedSourceIndexes: [1, 2],
      });
      const aligned = parseAndAlignRagResponse(json, mockSources);
      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.fuentes).toHaveLength(1);
      expect(aligned.fuentes[0].documentId).toBe('d1');
      expect(aligned.respuesta).toBe('Solo se respalda el hecho con el documento [1].');
    });

    it('texto cita [1, 3] pero fuentes tiene 2 elementos -> descarta [3] dangling y renumera', () => {
      const twoSources = mockSources.slice(0, 2);
      const json = JSON.stringify({
        answer: 'Punto respaldado [1] y afirmación colgada sin fuente válida [3].',
        hasEvidence: true,
        citedSourceIndexes: [1, 3],
      });
      const aligned = parseAndAlignRagResponse(json, twoSources);
      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.fuentes).toHaveLength(1);
      expect(aligned.fuentes[0].documentId).toBe('d1');
      expect(aligned.respuesta).toBe('Punto respaldado [1] y afirmación colgada sin fuente válida .');
      expect(aligned.respuesta).not.toContain('[3]');
    });

    it('respuesta negativa con hasEvidence: false y fuentes no vacías en prompt -> fuentes queda []', () => {
      const json = JSON.stringify({
        answer: 'No surge información sobre la póliza de caución [1].',
        hasEvidence: false,
        citedSourceIndexes: [1],
      });
      const aligned = parseAndAlignRagResponse(json, mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
      expect(aligned.respuesta).not.toContain('[1]');
    });

    it('respuesta positiva con citas válidas -> preserva texto y fuentes alineadas 1 a 1', () => {
      const json = JSON.stringify({
        answer: 'Primer hecho probado en [2] y segundo hecho en [3].',
        hasEvidence: true,
        citedSourceIndexes: [2, 3],
      });
      const aligned = parseAndAlignRagResponse(json, mockSources);
      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.fuentes).toHaveLength(2);
      expect(aligned.fuentes[0].documentId).toBe('d2');
      expect(aligned.fuentes[1].documentId).toBe('d3');
      expect(aligned.respuesta).toBe('Primer hecho probado en [1] y segundo hecho en [2].');
    });

    it('maneja citas compuestas [1, 7] cuando solo hay 1 fuente disponible -> texto queda [1] y fuentes tiene 1 elemento', () => {
      const singleSource = [mockSources[0]];
      const json = JSON.stringify({
        answer: 'Dato corroborado en [1, 7].',
        hasEvidence: true,
        citedSourceIndexes: [1, 7],
      });
      const aligned = parseAndAlignRagResponse(json, singleSource);
      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.respuesta).toBe('Dato corroborado en [1].');
      expect(aligned.fuentes).toHaveLength(1);
      expect(aligned.fuentes[0].documentId).toBe('d1');
    });

    it('maneja citas compuestas con múltiples índices válidos y renumera [3, 1, 3] y [1,2]', () => {
      const json = JSON.stringify({
        answer: 'Evidencia inicial [3, 1, 3] y respaldo complementario [1,2].',
        hasEvidence: true,
        citedSourceIndexes: [1, 2, 3],
      });
      const aligned = parseAndAlignRagResponse(json, mockSources);
      expect(aligned.hasEvidence).toBe(true);
      // [3, 1] orden de aparición: primero 3 -> [1], luego 1 -> [2], luego 2 -> [3]
      expect(aligned.respuesta).toBe('Evidencia inicial [1, 2] y respaldo complementario [2, 3].');
      expect(aligned.fuentes).toHaveLength(3);
      expect(aligned.fuentes[0].documentId).toBe('d3');
      expect(aligned.fuentes[1].documentId).toBe('d1');
      expect(aligned.fuentes[2].documentId).toBe('d2');
    });

    it('minimiza respuestas negativas evitando fuga de PII (DNI, pasaporte, etc.)', () => {
      const jsonWithPII = JSON.stringify({
        answer: 'No se menciona el número de pasaporte, pero el DNI es 30.123.456 perteneciente a Juan Pérez.',
        hasEvidence: false,
        citedSourceIndexes: [1],
      });
      const aligned = parseAndAlignRagResponse(jsonWithPII, mockSources);
      expect(aligned.hasEvidence).toBe(false);
      expect(aligned.fuentes).toEqual([]);
      expect(aligned.respuesta).toBe(RESPUETA_NEGATIVA_ESTANDAR);
      expect(aligned.respuesta).not.toContain('30.123.456');
      expect(aligned.respuesta).not.toContain('Juan Pérez');
    });

    it('normaliza markdown crudo eliminando asteriscos como **Laura Pérez**', () => {
      const rawText = 'La titular de dominio es **Laura Pérez** según constancia [1].';
      const aligned = parseAndAlignRagResponse(rawText, mockSources);
      expect(aligned.hasEvidence).toBe(true);
      expect(aligned.respuesta).toBe('La titular de dominio es Laura Pérez según constancia [1].');
      expect(aligned.respuesta).not.toContain('**');
    });

    it('normalizarMarkdownTexto limpia negritas, cursivas, encabezados y código en línea', () => {
      expect(normalizarMarkdownTexto('El comprador es **Juan Carlos López**')).toBe('El comprador es Juan Carlos López');
      expect(normalizarMarkdownTexto('### Informe Final')).toBe('Informe Final');
      expect(normalizarMarkdownTexto('El valor es `1500 USD` y fue pagado')).toBe('El valor es 1500 USD y fue pagado');
    });
  });
});
