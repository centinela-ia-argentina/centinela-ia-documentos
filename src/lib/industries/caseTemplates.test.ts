import { describe, it, expect } from 'vitest';
import { getCaseTemplate } from './caseTemplates';

describe('caseTemplates.ts - Selección por industria y caseType', () => {
  it('1. Jurídico + Sucesión selecciona la plantilla jurídica', () => {
    const template = getCaseTemplate('legal', 'Sucesión');
    expect(template.checklist).toContain('Publicación de edictos');
    expect(template.checklist).toContain('Declaratoria de herederos');
    expect(template.checklist).not.toContain('Certificado de dominio');
  });

  it('2. Escribanía + Sucesión selecciona la plantilla notarial', () => {
    const template = getCaseTemplate('escribania', 'Sucesión');
    expect(template.checklist).toContain('Certificado de dominio');
    expect(template.checklist).toContain('Certificado de inhibiciones');
    expect(template.checklist).not.toContain('Publicación de edictos');
  });

  it('3. Ambas listas son distintas', () => {
    const tLegal = getCaseTemplate('legal', 'Sucesión');
    const tEscrib = getCaseTemplate('escribania', 'Sucesión');
    expect(tLegal.checklist).not.toEqual(tEscrib.checklist);
  });

  it('4. La jurídica conserva Publicación de edictos y Declaratoria de herederos', () => {
    const template = getCaseTemplate('legal', 'Sucesión');
    expect(template.checklist).toContain('Publicación de edictos');
    expect(template.checklist).toContain('Declaratoria de herederos');
  });

  it('5. La notarial contiene Certificado de dominio y documentación de instrumentación/adjudicación', () => {
    const template = getCaseTemplate('escribania', 'Sucesión');
    expect(template.checklist).toContain('Certificado de dominio');
    expect(template.checklist).toContain('Datos necesarios para la escritura de adjudicación');
  });

  it('6. Una industria no puede obtener la plantilla exclusiva de otra industria', () => {
    const tLegal = getCaseTemplate('legal', 'Sucesión');
    expect(tLegal.checklist).not.toContain('Certificado de dominio');
    const tEscrib = getCaseTemplate('escribania', 'Sucesión');
    expect(tEscrib.checklist).not.toContain('Publicación de edictos');
  });

  it('7. Los tipos válidos existentes de Jurídico, Inmobiliaria y Escribanía continúan resolviendo una plantilla', () => {
    expect(getCaseTemplate('legal', 'Demanda').checklist).toContain('Escrito de demanda');
    expect(getCaseTemplate('inmobiliaria', 'Alquiler').checklist).toContain('Garantía');
    expect(getCaseTemplate('escribania', 'Poder').checklist).toContain('Objeto y facultades del poder (general o especial)');
  });

  it('8. Un tipo desconocido no reutiliza una plantilla cross-industry', () => {
    const template = getCaseTemplate('empresa', 'Inexistente');
    expect(template.checklist).toContain('Documento principal'); // fallbackTemplate
  });
});
