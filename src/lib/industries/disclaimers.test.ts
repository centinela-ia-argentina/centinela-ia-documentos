import { describe, it, expect } from 'vitest';
import { getAiDisclaimer } from './disclaimers';

describe('C-M3-J-002: AI Disclaimers per vertical', () => {
  it('returns legal disclaimer with explicit legal assistance reservation', () => {
    const text = getAiDisclaimer('legal');
    expect(text).toContain('No reemplaza el asesoramiento ni el patrocinio letrado profesional');
    expect(text).toContain('validados por un profesional del derecho');
  });

  it('returns notarial disclaimer with qualification and title deed reservation', () => {
    const text = getAiDisclaimer('escribania');
    expect(text).toContain('No reemplaza la calificación notarial profesional');
    expect(text).toContain('dictamen de títulos');
  });

  it('returns real estate disclaimer with appraisal and legal reservation', () => {
    const text = getAiDisclaimer('inmobiliaria');
    expect(text).toContain('No reemplaza una tasación, asesoramiento legal');
  });

  it('returns generic fallback disclaimer for unknown or missing industry', () => {
    const text = getAiDisclaimer('general');
    expect(text).toContain('Todo resultado debe ser revisado por un profesional');

    const textEmpty = getAiDisclaimer(undefined);
    expect(textEmpty).toContain('Todo resultado debe ser revisado por un profesional');
  });
});
