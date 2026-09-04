import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODELOS, getModeloReviewStatus, getModelosInventory } from './modelos';
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
      titulo: 'Intimación laboral — registración (Ley 24.013)',
      cuerpo: 'plantilla',
      valores: {},
      instruccion: 'Redactar',
      industria: 'legal',
      modeloId: 'intimacion-laboral-registracion',
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

  it('getModelosInventory() lists all 84 catalog models with complete governance metadata', () => {
    const inventory = getModelosInventory();
    expect(inventory.length).toBe(84);

    const outdated = inventory.filter((m) => m.reviewStatus === 'outdated');
    const pending = inventory.filter((m) => m.reviewStatus === 'pending_review');
    const verified = inventory.filter((m) => m.reviewStatus === 'verified');

    expect(outdated.length).toBe(1);
    expect(outdated[0].id).toBe('intimacion-laboral-registracion');
    expect(pending.length).toBe(83);
    expect(verified.length).toBe(0);

    for (const item of inventory) {
      expect(item.id).toBeTruthy();
      expect(item.titulo).toBeTruthy();
      expect(item.categoria).toBeTruthy();
      expect(item.jurisdiction).toBeTruthy();
      expect(item.version).toBe('1.0');
    }
  });
});
