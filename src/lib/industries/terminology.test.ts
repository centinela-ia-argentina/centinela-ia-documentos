import { describe, it, expect } from 'vitest';
import { getIndustryTerms } from './uiLabels';

describe('T-AUD-P2-012 & T-AUD-P2-013: Terminología transversal y etiquetas por industria', () => {
  it('1. Legal: devuelve términos de expediente y etiquetas judiciales consistentes', () => {
    const terms = getIndustryTerms('legal');
    expect(terms.expedienteSingular).toBe('Expediente');
    expect(terms.expedientePlural).toBe('Expedientes');
    expect(terms.elExpediente).toBe('el expediente');
    expect(terms.losExpedientes).toBe('los expedientes');
    expect(terms.unExpediente).toBe('un expediente');
    expect(terms.eseExpediente).toBe('ese expediente');
    expect(terms.delExpediente).toBe('del expediente');
    expect(terms.adjetivoActivo).toBe('activo');
    expect(terms.adjetivoActivos).toBe('activos');
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
    expect(terms.elExpediente).toBe('el legajo');
    expect(terms.losExpedientes).toBe('los legajos');
    expect(terms.unExpediente).toBe('un legajo');
    expect(terms.eseExpediente).toBe('ese legajo');
    expect(terms.delExpediente).toBe('del legajo');
    expect(terms.adjetivoActivo).toBe('activo');
    expect(terms.adjetivoActivos).toBe('activos');
    expect(terms.itemSinTitulo).toBe('Legajo sin título');
    expect(terms.contextoDelLegajo).toBe('CONTEXTO DEL LEGAJO');
    expect(terms.cronologiaDelLegajo).toBe('CRONOLOGÍA DEL LEGAJO');
    expect(terms.partes).toBe('Personas intervinientes');
    expect(terms.feriaLabel).not.toBe('Feria judicial');
    expect(terms.feriaLabel).toBe('Feria notarial / Día inhábil');
    expect(terms.agenteSaludoGlobal).toContain('notarial');
    expect(terms.agenteSaludoGlobal).not.toContain('expediente');
  });

  it('3. Inmobiliaria: devuelve términos de operación y concordancia gramatical femenina estricta', () => {
    const terms = getIndustryTerms('inmobiliaria');
    expect(terms.expedienteSingular).toBe('Operación');
    expect(terms.expedientePlural).toBe('Operaciones');
    expect(terms.elExpediente).toBe('la operación');
    expect(terms.losExpedientes).toBe('las operaciones');
    expect(terms.unExpediente).toBe('una operación');
    expect(terms.eseExpediente).toBe('esa operación');
    expect(terms.delExpediente).toBe('de la operación');
    expect(terms.adjetivoActivo).toBe('activa');
    expect(terms.adjetivoActivos).toBe('activas');
    expect(terms.todosLosLegajosActivos).toBe('todas las operaciones activas');
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
      for (const [, val] of Object.entries(terms)) {
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

  it('5. AgenteChat: placeholders dinámicos con concordancia gramatical correcta por vertical', () => {
    const verticals = ['legal', 'escribania', 'inmobiliaria'] as const;
    for (const v of verticals) {
      const terms = getIndustryTerms(v);
      const placeholder = `Escribí tu consulta sobre ${terms.elExpediente}…`;
      expect(placeholder).not.toContain('${terms');
      if (v === 'legal') expect(placeholder).toBe('Escribí tu consulta sobre el expediente…');
      if (v === 'escribania') expect(placeholder).toBe('Escribí tu consulta sobre el legajo…');
      if (v === 'inmobiliaria') expect(placeholder).toBe('Escribí tu consulta sobre la operación…');
    }
  });

  it('6. Regresiones negativas gramaticales: prohíbe combinaciones descalzadas en inmobiliaria', () => {
    const terms = getIndustryTerms('inmobiliaria');
    const allStringValues = Object.values(terms)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .toLowerCase();

    expect(allStringValues).not.toContain('el operación');
    expect(allStringValues).not.toContain('los operaciones');
    expect(allStringValues).not.toContain('un operación');
    expect(allStringValues).not.toContain('ese operación');
    expect(allStringValues).not.toContain('del operación');
    expect(allStringValues).not.toContain('operaciones activos');

    // Validación sobre strings compuestos generados en acciones y chat
    const consultaStr = `Escribí tu consulta sobre ${terms.elExpediente}…`.toLowerCase();
    const noEncontradoStr = `${terms.EseExpediente} no aparece entre ${terms.losExpedientes} ${terms.adjetivoActivos}`.toLowerCase();
    const unCasoStr = `cambiar estado de ${terms.unExpediente}`.toLowerCase();
    const delCasoStr = `documentos ${terms.delExpediente}`.toLowerCase();

    for (const evaluated of [consultaStr, noEncontradoStr, unCasoStr, delCasoStr]) {
      expect(evaluated).not.toContain('el operación');
      expect(evaluated).not.toContain('los operaciones');
      expect(evaluated).not.toContain('un operación');
      expect(evaluated).not.toContain('ese operación');
      expect(evaluated).not.toContain('del operación');
      expect(evaluated).not.toContain('operaciones activos');
    }
  });

  it('7. T-AUD-P2-013: Prohibición específica de "otorgantes" como categoría general de todas las personas del legajo', () => {
    const escribaniaTerms = getIndustryTerms('escribania');
    // Partes debe ser inclusivo y no restringido a otorgantes
    expect(escribaniaTerms.partes).not.toBe('Otorgantes');
    expect(escribaniaTerms.partes).toBe('Personas intervinientes');

    // El subtítulo del listado debe reflejar "personas intervinientes" y no "otorgantes"
    expect(escribaniaTerms.listaSubtitulo.toLowerCase()).not.toContain('otorgantes');
    expect(escribaniaTerms.listaSubtitulo.toLowerCase()).toContain('personas intervinientes');
  });
});
