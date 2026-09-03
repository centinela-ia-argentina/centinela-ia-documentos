import { describe, it, expect } from 'vitest';
import {
  MODELOS,
  sugerirModeloNotarialPorTipo,
  extractModelVars,
} from './modelos';

describe('T-AUD-P3-003: Modelo notarial sucesorio en catálogo', () => {
  it('1. el catálogo MODELOS incluye notarial-cesion-derechos-hereditarios exclusivamente para escribanía', () => {
    const modelo = MODELOS.find((m) => m.id === 'notarial-cesion-derechos-hereditarios');
    expect(modelo).toBeDefined();
    expect(modelo?.titulo).toBe('Escritura de cesión de derechos hereditarios');
    expect(modelo?.categoria).toBe('Sucesiones');
    expect(modelo?.industries).toEqual(['escribania']);
    expect(modelo?.descripcion).toContain('cesión onerosa');
    expect(modelo?.descripcion).toContain('No aplicable a partición ni a toda sucesión');
  });

  it('2. extractModelVars extrae correctamente las variables esenciales del instrumento', () => {
    const modelo = MODELOS.find((m) => m.id === 'notarial-cesion-derechos-hereditarios')!;
    const vars = extractModelVars(modelo.cuerpo);
    expect(vars).toContain('cedente');
    expect(vars).toContain('cesionario');
    expect(vars).toContain('caratula_sucesion');
    expect(vars).toContain('causante');
    expect(vars).toContain('precio');
    expect(vars).toContain('escribano');
  });

  it('3. sugerirModeloNotarialPorTipo exige evidencia explícita de cesión y es fail-closed para otros actos', () => {
    // Casos válidos con evidencia explícita de cesión:
    expect(sugerirModeloNotarialPorTipo('Cesión de derechos hereditarios')?.id).toBe(
      'notarial-cesion-derechos-hereditarios'
    );
    expect(sugerirModeloNotarialPorTipo('Cesion hereditaria')?.id).toBe(
      'notarial-cesion-derechos-hereditarios'
    );
    expect(sugerirModeloNotarialPorTipo('Cesión de herencia')?.id).toBe(
      'notarial-cesion-derechos-hereditarios'
    );
    expect(sugerirModeloNotarialPorTipo('Ceder derechos sucesorios')?.id).toBe(
      'notarial-cesion-derechos-hereditarios'
    );

    // Casos genéricos o distintos a una cesión devuelven null:
    expect(sugerirModeloNotarialPorTipo('Trámite de sucesión')).toBeNull();
    expect(sugerirModeloNotarialPorTipo('Sucesión')).toBeNull();
    expect(sugerirModeloNotarialPorTipo('Partición de herencia')).toBeNull();
    expect(sugerirModeloNotarialPorTipo('Adjudicación hereditaria')).toBeNull();
  });

  it('4. el cuerpo del modelo contiene todas las cláusulas esenciales de cesión onerosa hereditaria', () => {
    const modelo = MODELOS.find((m) => m.id === 'notarial-cesion-derechos-hereditarios')!;
    expect(modelo.cuerpo).toContain('CESIÓN DE DERECHOS HEREDITARIOS');
    expect(modelo.cuerpo).toContain('PRIMERO — ANTECEDENTES');
    expect(modelo.cuerpo).toContain('SEGUNDO — CESIÓN');
    expect(modelo.cuerpo).toContain('TERCERO — PRECIO Y FORMA DE PAGO');
    expect(modelo.cuerpo).toContain('CUARTO — GARANTÍA Y EVICCIÓN');
    expect(modelo.cuerpo).toContain('QUINTO — PRESENTACIÓN EN AUTOS');
  });
});
