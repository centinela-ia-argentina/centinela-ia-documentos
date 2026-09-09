import { describe, it, expect } from 'vitest';
import { sanitizeTextoInmobiliario, contieneTerminosJudicialesInapropiados } from './sanitizerInmobiliaria';

describe('sanitizerInmobiliaria', () => {
  it('reemplaza "expediente/legajo/operación" por "operación"', () => {
    const raw = 'Confirmar que el documento esté vinculado al expediente/legajo/operación correcto.';
    const res = sanitizeTextoInmobiliario(raw);
    expect(res).not.toContain('expediente/legajo/operación');
    expect(res).toContain('operación');
  });

  it('reemplaza "del expediente" por "de la operación"', () => {
    const raw = 'Documentos del expediente subidos recientemente.';
    const res = sanitizeTextoInmobiliario(raw);
    expect(res).toBe('Documentos de la operación subidos recientemente.');
  });

  it('reemplaza "al expediente" por "a la operación"', () => {
    const raw = 'Asociar el documento al expediente correspondiente.';
    const res = sanitizeTextoInmobiliario(raw);
    expect(res).toBe('Asociar el documento a la operación correspondiente.');
  });

  it('reemplaza "el expediente" por "la operación"', () => {
    const raw = 'Cerrar el expediente una vez completado.';
    const res = sanitizeTextoInmobiliario(raw);
    expect(res).toBe('Cerrar la operación una vez completado.');
  });

  it('detecta correctamente términos judiciales inapropiados', () => {
    expect(contieneTerminosJudicialesInapropiados('Ver expediente en juzgado')).toBe(true);
    expect(contieneTerminosJudicialesInapropiados('Revisar legajo')).toBe(true);
    expect(contieneTerminosJudicialesInapropiados('Ver autos caratulados')).toBe(true);
    expect(contieneTerminosJudicialesInapropiados('Revisar la operación inmobiliaria')).toBe(false);
  });
});
