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
    it('1. Jurídico + Demanda: permitido', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Demanda')).toEqual({ industry: 'legal', caseType: 'Demanda' });
    });
    it('2. Jurídico + Escritura: denegado', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Escritura').error).toBe('invalid_case_type');
    });
    it('3. Inmobiliaria + Compraventa de inmueble: permitido', () => {
      expect(resolveCaseTypeForIndustry('inmobiliaria', 'Compraventa de inmueble')).toEqual({ industry: 'inmobiliaria', caseType: 'Compraventa de inmueble' });
    });
    it('4. Inmobiliaria + Demanda: denegado', () => {
      expect(resolveCaseTypeForIndustry('inmobiliaria', 'Demanda').error).toBe('invalid_case_type');
    });
    it('5. Escribanía + Escritura: permitido', () => {
      expect(resolveCaseTypeForIndustry('escribania', 'Escritura')).toEqual({ industry: 'escribania', caseType: 'Escritura' });
    });
    it('6. Escribanía + Demanda: denegado', () => {
      expect(resolveCaseTypeForIndustry('escribania', 'Demanda').error).toBe('invalid_case_type');
    });
    it('7. Jurídico + Sucesión: permitido', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Sucesión')).toEqual({ industry: 'legal', caseType: 'Sucesión' });
    });
    it('8. Escribanía + Sucesión: permitido', () => {
      expect(resolveCaseTypeForIndustry('escribania', 'Sucesión')).toEqual({ industry: 'escribania', caseType: 'Sucesión' });
    });
    it('9. case_type vacío: denegado', () => {
      expect(resolveCaseTypeForIndustry('legal', '').error).toBe('invalid_case_type');
      expect(resolveCaseTypeForIndustry('legal', null).error).toBe('invalid_case_type');
    });
    it('10. case_type desconocido: denegado', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Inventado').error).toBe('invalid_case_type');
    });
    it('11. case_type válido con espacios externos: permitido después de trim', () => {
      expect(resolveCaseTypeForIndustry('legal', '  Demanda  ')).toEqual({ industry: 'legal', caseType: 'Demanda' });
    });
    it('12. Industria ausente o desconocida: denegada, sin fallback a general', () => {
      expect(resolveCaseTypeForIndustry(null, 'Demanda').error).toBe('invalid_industry');
      expect(resolveCaseTypeForIndustry('inexistente', 'Demanda').error).toBe('invalid_industry');
      expect(resolveCaseTypeForIndustry(null, 'Demanda').industry).toBe('general'); // Retorna general pero con error, fallando cerrado
    });
    it('13. Un tipo perteneciente a empresa no debe aceptarse para Jurídico, Inmobiliaria o Escribanía', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Legajo de empleado').error).toBe('invalid_case_type');
    });
    it('14. Otro solo se acepta cuando figure en getCaseTypes para esa industria', () => {
      expect(resolveCaseTypeForIndustry('legal', 'Otro')).toEqual({ industry: 'legal', caseType: 'Otro' });
    });
  });
});

