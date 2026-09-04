import { describe, it, expect } from 'vitest';
import {
  LEGAL_PARAMETERS,
  getParameterInventory,
  isParameterUsable,
  type ParameterStatus,
  type GovernedParameter,
} from './config';

describe('Legal Parameters Governance', () => {
  it('getParameterInventory() returns all registered parameters with full governance schema', () => {
    const inventory = getParameterInventory();
    expect(inventory.length).toBeGreaterThanOrEqual(8);

    for (const param of inventory) {
      expect(param.identifier).toBeTruthy();
      expect(param.jurisdiction).toBeTruthy();
      expect(typeof param.value).toBe('number');
      expect(param.unit).toBeTruthy();
      expect(param.sourceName).toBeTruthy();
      expect(param.effectiveFrom).toBeTruthy();
      expect(['verified', 'pending', 'expired', 'unavailable']).toContain(param.status);
      expect(typeof param.legalScope).toBe('string');
      expect(typeof param.orientative).toBe('boolean');
    }
  });

  it('verifies that UHOM, Jus PBA, Jus Corrientes and UMA have status "pending"', () => {
    expect(LEGAL_PARAMETERS.uhom.status).toBe('pending');
    expect(LEGAL_PARAMETERS.jus_pba.status).toBe('pending');
    expect(LEGAL_PARAMETERS.jus_corrientes.status).toBe('pending');
    expect(LEGAL_PARAMETERS.uma.status).toBe('pending');
  });

  it('verifies that tasa_justicia_nacion has status "verified" with valid source', () => {
    const tasaNac = LEGAL_PARAMETERS.tasa_justicia_nacion;
    expect(tasaNac.status).toBe('verified');
    expect(tasaNac.value).toBe(3);
    expect(tasaNac.sourceName).toContain('Ley 23.898');
    expect(tasaNac.sourceUrl).toContain('infoleg');
  });

  it('verifies that provincial court fees (PBA and Corrientes) have status "unavailable"', () => {
    expect(LEGAL_PARAMETERS.tasa_justicia_pba.status).toBe('unavailable');
    expect(LEGAL_PARAMETERS.tasa_justicia_corrientes.status).toBe('unavailable');
  });

  it('validates lifecycle behavior for all 4 states (verified, pending, expired, unavailable)', () => {
    const mockVerified: GovernedParameter = {
      identifier: 'test_verified',
      jurisdiction: 'nacion',
      value: 100,
      unit: 'ARS',
      sourceName: 'Test Source',
      sourceUrl: 'https://example.com',
      effectiveFrom: '2026-01-01',
      verifiedAt: '2026-09-04',
      status: 'verified',
      legalScope: 'Nacional',
      orientative: true,
      identificador: 'test_verified',
      concepto: 'Test',
      jurisdiccion: 'nacion',
      valor: 100,
      unidad: 'ARS',
      vigencia_desde: '2026-01-01',
      fuente: 'Test Source',
      url: 'https://example.com',
      verification_status: 'verificada',
      aplicabilidad_juridica: 'Nacional',
      caracter_orientativo: true,
    };

    const mockPending: GovernedParameter = { ...mockVerified, status: 'pending' };
    const mockExpired: GovernedParameter = { ...mockVerified, status: 'expired' };
    const mockUnavailable: GovernedParameter = { ...mockVerified, status: 'unavailable' };

    expect(isParameterUsable(mockVerified)).toBe(true);
    expect(isParameterUsable(mockPending)).toBe(false);
    expect(isParameterUsable(mockExpired)).toBe(false);
    expect(isParameterUsable(mockUnavailable)).toBe(false);
  });
});
