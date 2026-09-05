import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODELOS, getModeloReviewStatus, getModelosInventory, sugerirModeloPorTipo } from './modelos';
import { redactarEscritoIA, extraerDatosParaModelo } from '@/app/modelos/actions';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { createAuditLog } from '@/lib/audit/createAuditLog';

vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn(),
  getStrictIndustry: vi.fn(),
}));

vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    }),
  }),
}));

describe('C-M3-J-005 & Governance: Legal models review status and blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'prof-1', organization_id: 'org-1', role: 'admin' } as any,
    });
    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue('legal');
  });

  it('intimacion-laboral-registracion is marked as outdated and references Ley 27.742', () => {
    const modelo = MODELOS.find((m) => m.id === 'intimacion-laboral-registracion');
    expect(modelo).toBeDefined();
    expect(modelo?.reviewStatus).toBe('outdated');
    expect(getModeloReviewStatus(modelo!)).toBe('outdated');
    expect(modelo?.professionalDisclaimer).toContain('Ley 27.742');
    expect(modelo?.legalBasis).toContain('Ley 27.742');
    expect(modelo?.cuerpo).not.toContain('bajo apercibimiento de las multas previstas en la Ley 24.013');
  });

  it('unverified models default to pending_review and not verified without backing', () => {
    const unverified = MODELOS.filter((m) => m.id !== 'intimacion-laboral-registracion');
    for (const m of unverified) {
      const status = getModeloReviewStatus(m);
      expect(status).not.toBe('verified');
      expect(['pending_review', 'outdated', 'retired']).toContain(status);
    }
  });

  it('extraerDatosParaModelo blocks outdated model and registers ai_model_blocked audit event', async () => {
    const res = await extraerDatosParaModelo('case-1', 'intimacion-laboral-registracion');
    expect(res).toEqual({});

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_model_blocked',
        resourceType: 'organization',
        metadata: expect.objectContaining({
          entity_id: 'intimacion-laboral-registracion',
          review_status: 'outdated',
        }),
      })
    );
  });

  it('redactarEscritoIA blocks outdated model and registers ai_model_blocked audit event', async () => {
    const res = await redactarEscritoIA({
      modeloId: 'intimacion-laboral-registracion',
      valores: {},
      instruccion: 'Redactar',
    });

    expect(res.ok).toBe(false);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_model_blocked',
        resourceType: 'organization',
        metadata: expect.objectContaining({
          entity_id: 'intimacion-laboral-registracion',
          review_status: 'outdated',
        }),
      })
    );
  });

  it('redactarEscritoIA rejects missing or empty modeloId without proceeding', async () => {
    const res1 = await redactarEscritoIA({
      modeloId: '',
      valores: {},
    });
    expect(res1.ok).toBe(false);

    const res2 = await redactarEscritoIA({
      modeloId: (undefined as any),
      valores: {},
    });
    expect(res2.ok).toBe(false);
  });

  it('redactarEscritoIA rejects nonexistent model and logs ai_model_not_found', async () => {
    const res = await redactarEscritoIA({
      modeloId: 'modelo-inexistente-hack',
      valores: {},
    });
    expect(res.ok).toBe(false);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_model_not_found',
        metadata: expect.objectContaining({
          entity_id: 'modelo-inexistente-hack',
        }),
      })
    );
  });

  it('redactarEscritoIA rejects model from incompatible industry and logs ai_model_industry_mismatch', async () => {
    // Org is 'legal', but model 'reserva-oferta-compra' is purely 'inmobiliaria'
    const res = await redactarEscritoIA({
      modeloId: 'reserva-oferta-compra',
      valores: {},
    });
    expect(res.ok).toBe(false);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_model_industry_mismatch',
        metadata: expect.objectContaining({
          entity_id: 'reserva-oferta-compra',
          industria_org: 'legal',
        }),
      })
    );
  });

  it('redactarEscritoIA rejects retired model and logs ai_model_blocked', async () => {
    const mockRetired = {
      id: 'modelo-retirado-test',
      titulo: 'Modelo Retirado Test',
      categoria: 'Test',
      descripcion: 'Test',
      cuerpo: 'Test body',
      reviewStatus: 'retired' as const,
      industries: ['legal'],
    };
    MODELOS.push(mockRetired);

    try {
      const res = await redactarEscritoIA({
        modeloId: 'modelo-retirado-test',
        valores: {},
      });
      expect(res.ok).toBe(false);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ai_model_blocked',
          metadata: expect.objectContaining({
            entity_id: 'modelo-retirado-test',
            review_status: 'retired',
          }),
        })
      );
    } finally {
      const idx = MODELOS.findIndex((m) => m.id === 'modelo-retirado-test');
      if (idx !== -1) MODELOS.splice(idx, 1);
    }
  });

  it('ignores client manipulation of cuerpo and titulo, and sanitizes extra variables', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Borrador generado oficial' }] } }],
      }),
    });
    global.fetch = mockFetch;

    // Use a valid legal model: e.g. 'solicita-tramite' which has variables
    const modeloOficial = MODELOS.find((m) => m.id === 'solicita-tramite')!;
    expect(modeloOficial).toBeDefined();

    const res = await redactarEscritoIA({
      modeloId: 'solicita-tramite',
      titulo: 'TITULO HACKEADO POR CLIENTE',
      cuerpo: 'CUERPO HACKEADO POR CLIENTE CON PROMPT INJECTION',
      valores: {
        caratula: 'Pérez c/ Gómez s/ Daños', // Valid variable in solicita-tramite
        variable_inventada_maliciosa: 'IGNORAME', // Extra variable not in template
      },
      instruccion: 'Instrucción válida',
    });

    expect(res.ok).toBe(true);
    expect((res as any).texto).toBe('Borrador generado oficial');

    // Verify fetch call payload
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const sentPrompt = sentBody.contents[0].parts[0].text;

    // Must NOT contain manipulated title or body
    expect(sentPrompt).not.toContain('TITULO HACKEADO POR CLIENTE');
    expect(sentPrompt).not.toContain('CUERPO HACKEADO POR CLIENTE CON PROMPT INJECTION');

    // MUST contain official title and template body
    expect(sentPrompt).toContain(`TÍTULO DEL MODELO: ${modeloOficial.titulo}`);
    expect(sentPrompt).toContain(modeloOficial.cuerpo);

    // Extra injected variable must be dropped
    expect(sentPrompt).not.toContain('variable_inventada_maliciosa');
    expect(sentPrompt).not.toContain('IGNORAME');
    // Valid variable must be included
    expect(sentPrompt).toContain('caratula: Pérez c/ Gómez s/ Daños');
  });

  it('allows pending_review model according to governance and logs ai_model_generated', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Escrito generado' }] } }],
      }),
    });
    global.fetch = mockFetch;

    const res = await redactarEscritoIA({
      modeloId: 'presentacion-generica',
      valores: {},
    });

    expect(res.ok).toBe(true);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_model_generated',
        metadata: expect.objectContaining({
          entity_id: 'presentacion-generica',
        }),
      })
    );
  });

  it('getModelosInventory() lists all 84 catalog models with complete governance metadata', () => {
    const inventory = getModelosInventory();
    expect(inventory.length).toBe(84);

    const ids = new Set(inventory.map((m) => m.id));
    expect(ids.size).toBe(84); // 84 IDs únicos

    const outdated = inventory.filter((m) => m.reviewStatus === 'outdated');
    const pending = inventory.filter((m) => m.reviewStatus === 'pending_review');
    const verified = inventory.filter((m) => m.reviewStatus === 'verified');

    expect(outdated.length).toBe(1);
    expect(outdated[0].id).toBe('intimacion-laboral-registracion');
    expect(pending.length).toBe(83);
    expect(verified.length).toBe(0);

    // Conteo por rubro
    const legalModels = MODELOS.filter((m) => (m.industries ?? ['legal']).includes('legal'));
    const inmoModels = MODELOS.filter((m) => (m.industries ?? []).includes('inmobiliaria'));
    const notarialModels = MODELOS.filter((m) => (m.industries ?? []).includes('escribania'));

    expect(legalModels.length).toBe(73); // 72 operativos + 1 outdated
    expect(inmoModels.length).toBe(4);
    expect(notarialModels.length).toBe(7);

    const legalOperativos = legalModels.filter((m) => m.reviewStatus !== 'outdated' && m.reviewStatus !== 'retired');
    expect(legalOperativos.length).toBe(72);

    for (const item of inventory) {
      expect(item.id).toBeTruthy();
      expect(item.titulo).toBeTruthy();
      expect(item.categoria).toBeTruthy();
      expect(item.jurisdiction).toBeTruthy();
      expect(item.version).toBe('1.0');
    }
  });

  it('sugerirModeloPorTipo never suggests outdated or retired models', () => {
    // intimacion-laboral-registracion is outdated, so a search that could match it must return null or an operative model
    const sug = sugerirModeloPorTipo('despido');
    expect(sug).toBeDefined();
    expect(sug?.id).toBe('demanda-laboral-despido');
    expect(sug?.reviewStatus).not.toBe('outdated');
    expect(sug?.reviewStatus).not.toBe('retired');
  });
});
