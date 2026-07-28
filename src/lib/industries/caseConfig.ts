import type { IndustryType } from './documentTypes';

export type CaseFieldType = 'text' | 'select' | 'date';

export type CaseFieldDef = {
  key: string;
  label: string;
  type: CaseFieldType;
  options?: string[];
  sensitive?: boolean;
};

export type CaseStatusDef = {
  value: string;
  label: string;
};

export const caseFieldsByIndustry: Record<IndustryType, CaseFieldDef[]> = {
  legal: [
    { key: 'caratula', label: 'Carátula', type: 'text' },
    { key: 'numero_expediente', label: 'N° de expediente', type: 'text' },
    { key: 'juzgado', label: 'Juzgado / Tribunal', type: 'text' },
    {
      key: 'fuero',
      label: 'Fuero / Materia',
      type: 'select',
      options: [
        'Civil',
        'Comercial',
        'Laboral',
        'Penal',
        'Familia',
        'Contencioso Administrativo',
        'Previsional (Seguridad Social)',
        'Tributario / Fiscal',
        'Concursos y Quiebras',
        'Otro',
      ],
    },
    { key: 'parte_contraria', label: 'Parte contraria', type: 'text' },
    {
      key: 'estado_procesal',
      label: 'Estado procesal',
      type: 'select',
      options: [
        'Etapa prejudicial / Mediación',
        'Inicio de demanda',
        'Traslado / Notificación',
        'Contestación de demanda',
        'Etapa de prueba',
        'Alegatos',
        'Sentencia (1ª instancia)',
        'Apelación / 2ª instancia',
        'Ejecución de sentencia',
        'Archivado',
        'Otro',
      ],
    },
    { key: 'fecha_relevante', label: 'Próxima fecha clave / audiencia', type: 'date' },
  ],
  general: [],
  escribania: [
    { key: 'comparecientes', label: 'Comparecientes', type: 'text' },
    { key: 'tipo_acto', label: 'Tipo de acto notarial', type: 'text' },
    { key: 'registro_protocolo', label: 'Registro / protocolo', type: 'text' },
    { key: 'fecha_otorgamiento', label: 'Fecha de otorgamiento', type: 'date' },
    {
      key: 'sensibilidad',
      label: 'Nivel de sensibilidad',
      type: 'select',
      options: ['Baja', 'Media', 'Alta'],
      sensitive: true,
    },
  ],
  gestoria: [],
  inmobiliaria: [
    { key: 'direccion_inmueble', label: 'Dirección del inmueble', type: 'text' },
    { key: 'contraparte', label: 'Cliente / contraparte', type: 'text' },
    { key: 'valor_operacion', label: 'Valor de la operación', type: 'text' },
    { key: 'fecha_relevante', label: 'Fecha relevante', type: 'date' },
    {
      key: 'sensibilidad',
      label: 'Nivel de sensibilidad',
      type: 'select',
      options: ['Baja', 'Media', 'Alta'],
      sensitive: true,
    },
  ],
  empresa: [
    { key: 'area_responsable', label: 'Área responsable', type: 'text' },
    { key: 'contraparte', label: 'Contraparte / proveedor', type: 'text' },
    { key: 'referencia_interna', label: 'Referencia interna', type: 'text' },
    { key: 'fecha_relevante', label: 'Fecha relevante', type: 'date' },
    {
      key: 'sensibilidad',
      label: 'Nivel de sensibilidad',
      type: 'select',
      options: ['Baja', 'Media', 'Alta'],
      sensitive: true,
    },
  ],
  contable: [],
  drogueria: [],
  farma: [],
  industria: [],
  compliance: [],
  seguridad_documental: [],
};

export const caseTypesByIndustry: Record<IndustryType, string[]> = {
  legal: [
    'Caso jurídico',
    'Demanda',
    'Sucesión',
    'Contrato / Asesoramiento',
    'Reclamo',
    'Otro',
  ],
  general: ['General', 'Otro'],
  inmobiliaria: [
    'Compraventa de inmueble',
    'Alquiler',
    'Reserva',
    'Otro',
  ],
  contable: ['Carpeta contable mensual', 'Cliente', 'Proveedor', 'Otro'],
  escribania: ['Escritura', 'Poder', 'Sucesión', 'Certificación de firmas', 'Acta notarial', 'Otro'],
  gestoria: [],
  empresa: ['Legajo de empleado', 'Contrato comercial', 'Proveedor', 'Documentación societaria', 'Otro'],
  drogueria: [],
  farma: [],
  industria: [],
  compliance: [],
  seguridad_documental: [],
};

export type DashboardCardKey =
  | 'expedientes_activos'
  | 'proximos_plazos'
  | 'documentos_cargados'
  | 'analisis_pendientes'
  | 'documentos_sensibles'
  | 'documentos_por_vencer'
  | 'actividad_reciente';

export const dashboardCardsByIndustry: Record<IndustryType, DashboardCardKey[]> = {
  legal: [
    'expedientes_activos',
    'proximos_plazos',
    'documentos_cargados',
    'documentos_sensibles',
  ],
  general: ['documentos_cargados', 'documentos_por_vencer', 'actividad_reciente'],
  escribania: [
    'expedientes_activos',
    'documentos_cargados',
    'documentos_sensibles',
    'documentos_por_vencer',
  ],
  gestoria: [],
  inmobiliaria: [
    'expedientes_activos',
    'documentos_cargados',
    'documentos_sensibles',
    'documentos_por_vencer',
  ],
  empresa: [
    'expedientes_activos',
    'documentos_cargados',
    'documentos_sensibles',
    'documentos_por_vencer',
  ],
  contable: [],
  drogueria: [],
  farma: [],
  industria: [],
  compliance: [],
  seguridad_documental: [],
};

export const caseStatusesByIndustry: Record<IndustryType, CaseStatusDef[]> = {
  legal: [
    { value: 'new', label: 'Nuevo' },
    { value: 'active', label: 'Activo' },
    { value: 'in_review', label: 'En trámite' },
    { value: 'waiting_client', label: 'Esperando cliente' },
    { value: 'archived', label: 'Archivado' },
  ],
  general: [
    { value: 'new', label: 'Nuevo' },
    { value: 'active', label: 'Activo' },
    { value: 'archived', label: 'Archivado' },
  ],
  escribania: [
    { value: 'new', label: 'Ingresado' },
    { value: 'active', label: 'En preparación' },
    { value: 'in_review', label: 'Listo para firma' },
    { value: 'waiting_client', label: 'Esperando documentación' },
    { value: 'archived', label: 'Otorgado / archivado' },
  ],
  gestoria: [],
  inmobiliaria: [
    { value: 'new', label: 'En captación' },
    { value: 'active', label: 'Disponible / Publicada' },
    { value: 'in_review', label: 'En reserva' },
    { value: 'waiting_client', label: 'En cierre / Escrituración' },
    { value: 'archived', label: 'Cerrada / Archivada' },
  ],
  empresa: [
    { value: 'new', label: 'Nuevo' },
    { value: 'active', label: 'En gestión' },
    { value: 'in_review', label: 'En revisión' },
    { value: 'waiting_client', label: 'Esperando información' },
    { value: 'archived', label: 'Archivado' },
  ],
  contable: [],
  drogueria: [],
  farma: [],
  industria: [],
  compliance: [],
  seguridad_documental: [],
};

export const legacyCaseStatusLabels: Record<string, string> = {
  new: 'Nuevo',
  active: 'Activo',
  in_review: 'En trámite',
  incomplete: 'Incompleto',
  waiting_client: 'Esperando cliente',
  complete: 'Completo',
  completed: 'Completo',
  archived: 'Archivado',
  Activo: 'Activo',
  Archivado: 'Archivado',
  'En tramite': 'En trámite',
  'En trámite': 'En trámite',
};

export const OPEN_CASE_STATUSES: readonly string[] = [
  'new',
  'active',
  'in_review',
  'waiting_client',
  'incomplete',
  'Activo',
  'En tramite',
  'En trámite',
];

export const TERMINAL_CASE_STATUSES: readonly string[] = [
  'archived',
  'complete',
  'completed',
  'Archivado',
];

export function getCaseFields(industry: IndustryType): CaseFieldDef[] {
  return caseFieldsByIndustry[industry] ?? [];
}

export function getCaseStatuses(industry: IndustryType): CaseStatusDef[] {
  const statuses = caseStatusesByIndustry[industry];
  return statuses && statuses.length ? statuses : caseStatusesByIndustry.general;
}

export function getCaseTypes(industry: IndustryType): string[] {
  const types = caseTypesByIndustry[industry];
  return types && types.length ? types : caseTypesByIndustry.general;
}

export function getDashboardCards(industry: IndustryType): DashboardCardKey[] {
  const cards = dashboardCardsByIndustry[industry];
  return cards && cards.length ? cards : dashboardCardsByIndustry.general;
}

export function getCaseStatusLabel(status?: string | null, industry?: IndustryType) {
  if (!status) return 'Sin estado';

  if (industry) {
    const industryStatus = getCaseStatuses(industry).find((item) => item.value === status);
    if (industryStatus) return industryStatus.label;
  }

  for (const statuses of Object.values(caseStatusesByIndustry)) {
    const found = statuses.find((item) => item.value === status);
    if (found) return found.label;
  }

  return legacyCaseStatusLabels[status] ?? status;
}

export function getAllowedCaseStatuses(industry: IndustryType): string[] {
  return [
    ...getCaseStatuses(industry).map((status) => status.value),
    ...Object.keys(legacyCaseStatusLabels),
  ];
}

const legacyCaseTypeLabels: Record<string, string> = {
  REAL_ESTATE_PURCHASE: 'Compraventa de inmueble',
  RENTAL: 'Alquiler',
  RESERVATION: 'Reserva',
  GENERAL: 'General',
  LAWSUIT: 'Demanda',
  LEGAL_CASE: 'Caso jurídico',
  EMPLOYEE_FILE: 'Legajo de empleado',
};

export function getCaseTypeLabel(type?: string | null): string {
  if (!type) return 'General';
  const value = type.trim();
  if (!value) return 'General';
  // Normalizar para buscar en el mapa sin importar mayúsculas, espacios o guiones
  const key = value.toUpperCase().replace(/[\s-]+/g, '_');
  if (legacyCaseTypeLabels[key]) return legacyCaseTypeLabels[key];
  // Si parece un código (contiene guión bajo), prettificar: "algo_asi" -> "Algo asi"
  if (value.includes('_')) {
    const pretty = value.replace(/_/g, ' ').toLowerCase();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }
  // Si no, ya es una etiqueta legible (Demanda, Escritura, etc.) -> dejar tal cual
  return value;
}

export function isCaseActive(status?: string | null): boolean {
  if (!status) return false;
  return OPEN_CASE_STATUSES.includes(status);
}
