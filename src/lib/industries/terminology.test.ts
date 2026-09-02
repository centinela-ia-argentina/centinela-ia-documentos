import { describe, it, expect } from 'vitest';
import { getIndustryTerms } from './uiLabels';

describe('T-AUD-P2-012 & T-AUD-P2-013: Terminología transversal y etiquetas por industria', () => {
  it('1. Legal: devuelve términos de expediente y etiquetas judiciales consistentes', () => {
    const terms = getIndustryTerms('legal');
    expect(terms.expedienteSingular).toBe('Expediente');
    expect(terms.expedientePlural).toBe('Expedientes');
    expect(terms.itemSinTitulo).toBe('Expediente sin título');
    expect(terms.contextoDelLegajo).toBe('CONTEXTO DEL EXPEDIENTE');
    expect(terms.cronologiaDelLegajo).toBe('CRONOLOGÍA DEL EXPEDIENTE');
    expect(terms.partes).toBe('Partes');
    expect(terms.feriaLabel).toBe('Feria judicial');
    expect(terms.agenteSaludoGlobal).toContain('jurídico');
    expect(terms.agenteSaludoGlobal).toContain('expedientes');
    expect(terms.agenteSaludoGlobal).not.toContain('legajo');
    expect(terms.agenteSaludoGlobal).not.toContain('operación');
  });

  it('2. Escribanía: devuelve términos de legajo y etiqueta notarial "Personas intervinientes"', () => {
    const terms = getIndustryTerms('escribania');
    expect(terms.expedienteSingular).toBe('Legajo');
    expect(terms.expedientePlural).toBe('Legajos');
    expect(terms.itemSinTitulo).toBe('Legajo sin título');
    expect(terms.contextoDelLegajo).toBe('CONTEXTO DEL LEGAJO');
    expect(terms.cronologiaDelLegajo).toBe('CRONOLOGÍA DEL LEGAJO');
    // T-AUD-P2-013 requirement:
    expect(terms.partes).toBe('Personas intervinientes');
    expect(terms.feriaLabel).not.toBe('Feria judicial');
    expect(terms.feriaLabel).toBe('Feria notarial / Día inhábil');
    expect(terms.agenteSaludoGlobal).toContain('notarial');
    expect(terms.agenteSaludoGlobal).not.toContain('expediente');
  });

  it('3. Inmobiliaria: devuelve términos de operación y sin términos judiciales cruzados', () => {
    const terms = getIndustryTerms('inmobiliaria');
    expect(terms.expedienteSingular).toBe('Operación');
    expect(terms.expedientePlural).toBe('Operaciones');
    expect(terms.itemSinTitulo).toBe('Operación sin título');
    expect(terms.contextoDelLegajo).toBe('CONTEXTO DE LA OPERACIÓN');
    expect(terms.cronologiaDelLegajo).toBe('CRONOLOGÍA DE LA OPERACIÓN');
    expect(terms.feriaLabel).not.toBe('Feria judicial');
    expect(terms.feriaLabel).toBe('Feriado extendido');
    expect(terms.agenteSaludoGlobal).toContain('inmobiliario');
    expect(terms.agenteSaludoGlobal).toContain('operaciones');
    expect(terms.agenteSaludoGlobal).not.toContain('expediente');
    expect(terms.agenteSaludoGlobal).not.toContain('legajo');
  });

  it('4. Ninguna vertical genera cadenas mixtas o descalzadas como expediente/legajo/operación', () => {
    const verticals = ['legal', 'escribania', 'inmobiliaria', 'empresa', 'general'] as const;
    for (const v of verticals) {
      const terms = getIndustryTerms(v);
      for (const [key, val] of Object.entries(terms)) {
        if (typeof val === 'string') {
          expect(val).not.toContain('expediente/legajo/operación');
          expect(val).not.toContain('expediente / legajo');
        } else if (Array.isArray(val)) {
          for (const item of val) {
            expect(item).not.toContain('expediente/legajo/operación');
          }
        }
      }
    }
  });
});
