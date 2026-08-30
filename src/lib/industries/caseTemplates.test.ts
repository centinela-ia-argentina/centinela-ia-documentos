import { describe, it, expect } from 'vitest';
import { getCaseTemplate } from './caseTemplates';
import { ACTIVE_INDUSTRY_TYPES } from './documentTypes';
import { caseTypesByIndustry } from './caseConfig';

describe('caseTemplates.ts - Selección por industria y caseType', () => {
  it('1. getCaseTemplate("legal", "Alquiler") no devuelve plantilla', () => {
    expect(getCaseTemplate('legal', 'Alquiler')).toBeNull();
  });

  it('2. getCaseTemplate("inmobiliaria", "Demanda") no devuelve plantilla', () => {
    expect(getCaseTemplate('inmobiliaria', 'Demanda')).toBeNull();
  });

  it('3. getCaseTemplate("escribania", "Contrato / Asesoramiento") no devuelve plantilla', () => {
    expect(getCaseTemplate('escribania', 'Contrato / Asesoramiento')).toBeNull();
  });

  it('4. getCaseTemplate("empresa", "Poder") no devuelve plantilla notarial', () => {
    expect(getCaseTemplate('empresa', 'Poder')).toBeNull();
  });

  it('5. getCaseTemplate("gestoria", "General") no devuelve fallback', () => {
    expect(getCaseTemplate('gestoria', 'General')).toBeNull();
  });

  it('6. getCaseTemplate("legal", "Sucesión") devuelve la jurídica', () => {
    const template = getCaseTemplate('legal', 'Sucesión');
    expect(template).not.toBeNull();
    expect(template!.checklist).toContain('Publicación de edictos');
  });

  it('7. getCaseTemplate("escribania", "Sucesión") devuelve la notarial', () => {
    const template = getCaseTemplate('escribania', 'Sucesión');
    expect(template).not.toBeNull();
    expect(template!.checklist).toContain('Certificado de dominio');
  });

  it('8. getCaseTemplate("legal", "Otro") devuelve el fallback explícito permitido', () => {
    const template = getCaseTemplate('legal', 'Otro');
    expect(template).not.toBeNull();
    expect(template!.checklist).toContain('Documento principal');
  });

  it('9. getCaseTemplate("inmobiliaria", "Otro") devuelve el fallback explícito permitido', () => {
    const template = getCaseTemplate('inmobiliaria', 'Otro');
    expect(template).not.toBeNull();
    expect(template!.checklist).toContain('Documento principal');
  });

  it('10. Tipo inventado no devuelve fallback', () => {
    expect(getCaseTemplate('legal', 'Inventado')).toBeNull();
  });

  it('Parametrizada: recorre las combinaciones válidas configuradas y comprueba plantilla explícita', () => {
    for (const industry of ACTIVE_INDUSTRY_TYPES) {
      const validTypes = caseTypesByIndustry[industry];
      for (const caseType of validTypes) {
        const template = getCaseTemplate(industry, caseType);
        expect(template).not.toBeNull();
      }
    }
  });
});
