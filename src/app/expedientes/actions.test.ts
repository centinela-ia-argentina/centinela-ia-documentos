import { describe, it, expect } from 'vitest';
import { getChecklistItemsToInsert, getNextChecklistStatus, resolveCaseTypeForIndustry } from './helpers';

describe('Expedientes Actions Helpers', () => {
  describe('getChecklistItemsToInsert', () => {
    it('Debe identificar correctamente los items faltantes para un merge no destructivo', () => {
      const template = ['DNI', 'Escritura', 'Poder'];
      const current = ['DNI'];
      const missing = getChecklistItemsToInsert(template, current);
      expect(missing).toEqual(['Escritura', 'Poder']);
    });

    it('No debe insertar nada si todos existen', () => {
      const template = ['DNI', 'Escritura'];
      const current = ['DNI', 'Escritura', 'Otro viejo'];
      const missing = getChecklistItemsToInsert(template, current);
      expect(missing).toEqual([]);
    });
  });

  describe('getNextChecklistStatus', () => {
    it('Debe realizar transiciones de checklist', () => {
      expect(getNextChecklistStatus('pending')).toBe('received');
      expect(getNextChecklistStatus('received')).toBe('reviewed');
      expect(getNextChecklistStatus('reviewed')).toBe('pending');
      expect(getNextChecklistStatus('rejected')).toBe('pending');
      expect(getNextChecklistStatus('not_required')).toBe('pending');
    });
  });

  describe('resolveCaseTypeForIndustry', () => {
    it('1. Industria null devuelve solamente ok: false e invalid_industry sin industry ni caseType', () => {
      const result = resolveCaseTypeForIndustry(null, 'Demanda');
      expect(result).toEqual({ ok: false, error: 'invalid_industry' });
      expect('industry' in result).toBe(false);
      expect('caseType' in result).toBe(false);
    });

    it('2. Industria inexistente devuelve solamente ok: false e invalid_industry sin properties adicionales', () => {
      const result = resolveCaseTypeForIndustry('inexistente', 'Demanda');
      expect(result).toEqual({ ok: false, error: 'invalid_industry' });
    });

    it('3. gestoria + General devuelve invalid_industry por estar vacía', () => {
      expect(resolveCaseTypeForIndustry('gestoria', 'General')).toEqual({ ok: false, error: 'invalid_industry' });
    });

    it('4. contable + Otro devuelve invalid_industry', () => {
      expect(resolveCaseTypeForIndustry('contable', 'Otro')).toEqual({ ok: false, error: 'invalid_industry' });
    });

    it('5. compliance + General devuelve invalid_industry', () => {
      expect(resolveCaseTypeForIndustry('compliance', 'General')).toEqual({ ok: false, error: 'invalid_industry' });
    });

    it('6. legal + Demanda es válido', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Demanda')).toEqual({ ok: true, industry: 'legal', caseType: 'Demanda' });
    });

    it('7. legal + Escritura es invalid_case_type', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Escritura')).toEqual({ ok: false, error: 'invalid_case_type' });
    });

    it('8. inmobiliaria + Alquiler es válido', () => {
      expect(resolveCaseTypeForIndustry('inmobiliaria', 'Alquiler')).toEqual({ ok: true, industry: 'inmobiliaria', caseType: 'Alquiler' });
    });

    it('9. inmobiliaria + Demanda es invalid_case_type', () => {
      expect(resolveCaseTypeForIndustry('inmobiliaria', 'Demanda')).toEqual({ ok: false, error: 'invalid_case_type' });
    });

    it('10. escribania + Escritura es válido', () => {
      expect(resolveCaseTypeForIndustry('escribania', 'Escritura')).toEqual({ ok: true, industry: 'escribania', caseType: 'Escritura' });
    });

    it('11. escribania + Demanda es invalid_case_type', () => {
      expect(resolveCaseTypeForIndustry('escribania', 'Demanda')).toEqual({ ok: false, error: 'invalid_case_type' });
    });

    it('12. espacios externos en un tipo válido: permitido después de trim', () => {
      expect(resolveCaseTypeForIndustry('legal', '  Demanda  ')).toEqual({ ok: true, industry: 'legal', caseType: 'Demanda' });
    });
  });
});
