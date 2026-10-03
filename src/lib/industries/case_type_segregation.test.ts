import { describe, it, expect } from 'vitest';
import { isCaseTypeCompatibleWithIndustry, caseTypesByIndustry } from './caseConfig';
import type { IndustryType } from './documentTypes';

describe('C-M3-J-003 & Case Segregation: isCaseTypeCompatibleWithIndustry', () => {
  it('approves canonical legal case types for legal industry', () => {
    const legalTypes = caseTypesByIndustry.legal;
    expect(legalTypes).toContain('Demanda');
    expect(legalTypes).toContain('Sucesión');
    expect(legalTypes).toContain('Caso jurídico');

    for (const t of legalTypes) {
      expect(isCaseTypeCompatibleWithIndustry(t, 'legal')).toBe(true);
      expect(isCaseTypeCompatibleWithIndustry(t.toLowerCase(), 'legal')).toBe(true);
    }
  });

  it('approves canonical escribania case types for escribania industry', () => {
    const escTypes = caseTypesByIndustry.escribania;
    expect(escTypes).toContain('Escritura');
    expect(escTypes).toContain('Poder');
    expect(escTypes).toContain('Certificación de firmas');
    expect(escTypes).toContain('Acta notarial');

    for (const t of escTypes) {
      expect(isCaseTypeCompatibleWithIndustry(t, 'escribania')).toBe(true);
    }
  });

  it('approves canonical inmobiliaria case types for inmobiliaria industry', () => {
    const inmTypes = caseTypesByIndustry.inmobiliaria;
    expect(inmTypes).toContain('Compraventa de inmueble');
    expect(inmTypes).toContain('Alquiler');
    expect(inmTypes).toContain('Reserva');

    for (const t of inmTypes) {
      expect(isCaseTypeCompatibleWithIndustry(t, 'inmobiliaria')).toBe(true);
    }
  });

  it('rejects cross-industry case types (strict vertical isolation)', () => {
    // Legal types in Escribania
    expect(isCaseTypeCompatibleWithIndustry('Demanda', 'escribania')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('Caso jurídico', 'escribania')).toBe(false);

    // Legal types in Inmobiliaria
    expect(isCaseTypeCompatibleWithIndustry('Demanda', 'inmobiliaria')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('Contrato / Asesoramiento', 'inmobiliaria')).toBe(false);

    // Inmobiliaria types in Legal
    expect(isCaseTypeCompatibleWithIndustry('Compraventa de inmueble', 'legal')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('Alquiler', 'legal')).toBe(false);

    // Escribania types in Inmobiliaria
    expect(isCaseTypeCompatibleWithIndustry('Escritura', 'inmobiliaria')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('Certificación de firmas', 'inmobiliaria')).toBe(false);
  });

  it('rejects atypical, pre-existing or legacy incompatible records (conservative handling)', () => {
    expect(isCaseTypeCompatibleWithIndustry('civil', 'legal')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('venta', 'inmobiliaria')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('tipo_inventado_random', 'legal')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry('', 'legal')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry(null, 'legal')).toBe(false);
    expect(isCaseTypeCompatibleWithIndustry(undefined, 'legal')).toBe(false);
  });

  it('filters case lists for Agenda and Modelos selector accurately', () => {
    const rawCases = [
      { id: '1', title: 'Demanda laboral', case_type: 'Demanda' },
      { id: '2', title: 'Escritura traslativa', case_type: 'Escritura' },
      { id: '3', title: 'Boleto y compraventa', case_type: 'Compraventa de inmueble' },
      { id: '4', title: 'Caso legacy sin tipo', case_type: null },
      { id: '5', title: 'Sucesión ab-intestato', case_type: 'Sucesión' },
    ];

    // For Legal:
    const legalFiltered = rawCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, 'legal'));
    expect(legalFiltered.map((c) => c.id)).toEqual(['1', '5']);

    // For Escribania:
    const escFiltered = rawCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, 'escribania'));
    expect(escFiltered.map((c) => c.id)).toEqual(['2', '5']);

    // For Inmobiliaria:
    const inmFiltered = rawCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, 'inmobiliaria'));
    expect(inmFiltered.map((c) => c.id)).toEqual(['3']);
  });
});
