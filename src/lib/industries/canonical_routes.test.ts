import { describe, expect, it } from 'vitest';
import {
  getCaseBasePath,
  isCaseTypeCompatibleWithIndustry,
} from './caseConfig';

describe('rutas canónicas y segregación de operaciones', () => {
  it('usa /operaciones para inmobiliaria y /expedientes para las demás verticales', () => {
    expect(getCaseBasePath('inmobiliaria')).toBe('/operaciones');
    expect(getCaseBasePath('legal')).toBe('/expedientes');
    expect(getCaseBasePath('escribania')).toBe('/expedientes');
  });

  it('acepta tipos inmobiliarios canónicos y rechaza tipos de otras verticales', () => {
    expect(
      isCaseTypeCompatibleWithIndustry('Compraventa de inmueble', 'inmobiliaria')
    ).toBe(true);
    expect(isCaseTypeCompatibleWithIndustry('Alquiler', 'inmobiliaria')).toBe(
      true
    );
    expect(isCaseTypeCompatibleWithIndustry('Demanda', 'inmobiliaria')).toBe(
      false
    );
    expect(isCaseTypeCompatibleWithIndustry('Escritura', 'inmobiliaria')).toBe(
      false
    );
  });
});