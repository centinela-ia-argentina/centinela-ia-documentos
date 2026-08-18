import { describe, it, expect } from 'vitest';
import { getChecklistItemsToInsert, getNextChecklistStatus } from './helpers';

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
});
