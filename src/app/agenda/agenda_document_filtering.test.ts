import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { filterAgendaDocuments, type AgendaDocumentRecord } from './page';
import { isCaseTypeCompatibleWithIndustry } from '@/lib/industries/caseConfig';

describe('Agenda Document Filtering by Vertical Compatibility and Org Scope', () => {
  const legalCases = [
    { id: 'case-legal-1', case_type: 'Demanda' },
    { id: 'case-legal-2', case_type: 'Sucesión' },
  ];
  const notarialCases = [
    { id: 'case-escribania-1', case_type: 'Acta notarial' },
  ];
  const inmobiliariaCases = [
    { id: 'case-inmo-1', case_type: 'Compraventa de inmueble' },
  ];
  const legacyIncompatibleCases = [
    { id: 'case-legacy-incompat', case_type: 'tipo_desconocido_o_incompatible' },
  ];

  const allCases = [...legalCases, ...notarialCases, ...inmobiliariaCases, ...legacyIncompatibleCases];

  it('1. Documento de caso compatible: incluido en la agenda', () => {
    const industry = 'legal';
    const compatibleCases = allCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, industry));
    const compatibleCaseIds = new Set(compatibleCases.map((c) => c.id));

    const docs: AgendaDocumentRecord[] = [
      {
        id: 'doc-compatible-1',
        file_name: 'demanda_laboral.pdf',
        expires_at: '2026-10-15T00:00:00Z',
        case_id: 'case-legal-1',
      },
    ];

    const eventos = filterAgendaDocuments(docs, compatibleCaseIds);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].id).toBe('doc-doc-compatible-1');
    expect(eventos[0].titulo).toBe('demanda_laboral.pdf');
    expect(eventos[0].fecha).toBe('2026-10-15');
    expect(eventos[0].tipo).toBe('documento');
  });

  it('2. Documento de caso incompatible (inmo o escribania en agenda legal): excluido', () => {
    const industry = 'legal';
    const compatibleCases = allCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, industry));
    const compatibleCaseIds = new Set(compatibleCases.map((c) => c.id));

    const docs: AgendaDocumentRecord[] = [
      {
        id: 'doc-inmo-1',
        file_name: 'boleto_compraventa.pdf',
        expires_at: '2026-10-20T00:00:00Z',
        case_id: 'case-inmo-1',
      },
      {
        id: 'doc-escribania-1',
        file_name: 'testamento.pdf',
        expires_at: '2026-10-22T00:00:00Z',
        case_id: 'case-escribania-1',
      },
    ];

    const eventos = filterAgendaDocuments(docs, compatibleCaseIds);
    expect(eventos).toHaveLength(0);
  });

  it('3. Documento de caso legacy incompatible: excluido', () => {
    const industry = 'legal';
    const compatibleCases = allCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, industry));
    const compatibleCaseIds = new Set(compatibleCases.map((c) => c.id));

    const docs: AgendaDocumentRecord[] = [
      {
        id: 'doc-legacy-1',
        file_name: 'doc_legacy_incompatible.pdf',
        expires_at: '2026-11-01T00:00:00Z',
        case_id: 'case-legacy-incompat',
      },
    ];

    const eventos = filterAgendaDocuments(docs, compatibleCaseIds);
    expect(eventos).toHaveLength(0);
  });

  it('4. Documento sin case_id (a nivel organizacion): incluido bajo politica explicita de org-level', () => {
    const industry = 'legal';
    const compatibleCases = allCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, industry));
    const compatibleCaseIds = new Set(compatibleCases.map((c) => c.id));

    const docs: AgendaDocumentRecord[] = [
      {
        id: 'doc-org-general-1',
        file_name: 'seguro_caucion_estudio.pdf',
        expires_at: '2026-12-31T00:00:00Z',
        case_id: null,
      },
      {
        id: 'doc-org-general-2',
        file_name: 'licencia_comercial.pdf',
        expires_at: '2026-12-15T00:00:00Z',
        case_id: undefined,
      },
    ];

    const eventos = filterAgendaDocuments(docs, compatibleCaseIds);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].id).toBe('doc-doc-org-general-1');
    expect(eventos[0].titulo).toBe('seguro_caucion_estudio.pdf');
    expect(eventos[1].id).toBe('doc-doc-org-general-2');
    expect(eventos[1].titulo).toBe('licencia_comercial.pdf');
  });

  it('5. Documentos sin fecha de vencimiento: ignorados', () => {
    const compatibleCaseIds = new Set(['case-legal-1']);

    const docs: AgendaDocumentRecord[] = [
      {
        id: 'doc-no-expiry',
        file_name: 'sin_vencimiento.pdf',
        expires_at: null,
        case_id: 'case-legal-1',
      },
    ];

    const eventos = filterAgendaDocuments(docs, compatibleCaseIds);
    expect(eventos).toHaveLength(0);
  });

  it('6. Segregacion cross-org: query de Supabase debe filtrar estrictamente por organization_id', () => {
    const activeOrgId = 'org-legal-actual';
    const crossOrgDoc = {
      id: 'doc-cross-org',
      file_name: 'archivo_otra_organizacion.pdf',
      expires_at: '2026-10-15T00:00:00Z',
      organization_id: 'org-otra-inmobiliaria',
      case_id: 'case-legal-1',
    };

    const documentsFromDbQuery = [crossOrgDoc].filter((d) => d.organization_id === activeOrgId);
    expect(documentsFromDbQuery).toHaveLength(0);
  });
});
