import type { IndustryType } from './documentTypes';

// --- Título de grupo del sidebar, por rubro ---
const groupLabelOverrides: Partial<Record<IndustryType, Record<string, string>>> = {
  escribania: { 'Herramientas jurídicas': 'Herramientas notariales' },
  inmobiliaria: { 'Herramientas jurídicas': 'Herramientas inmobiliarias' },
};

export function getNavGroupLabel(group: string, industry: IndustryType): string {
  return groupLabelOverrides[industry]?.[group] ?? group;
}

// --- Nombre de ítems del sidebar, por rubro (clave = href) ---
const navLabelOverrides: Partial<Record<IndustryType, Record<string, string>>> = {
  escribania: { '/expedientes': 'Legajos' },
  inmobiliaria: { '/expedientes': 'Operaciones' },
};

export function getNavItemLabel(
  item: { href: string; name: string },
  industry: IndustryType
): string {
  return navLabelOverrides[industry]?.[item.href] ?? item.name;
}

const navDescriptionOverrides: Partial<Record<IndustryType, Record<string, string>>> = {
  escribania: {
    '/expedientes': 'Gestión operativa de legajos vinculados.',
    '/buscar': 'Búsqueda avanzada de legajos y documentos.',
    '/calculadoras': 'Sellos, ITI, honorarios y aportes notariales.',
    '/modelos': 'Escrituras, poderes, actas y autorizaciones notariales.',
  },
  inmobiliaria: {
    '/modelos': 'Reservas, autorizaciones y boletos de compraventa.',
  },
};

export function getNavItemDescription(
  item: { href: string; description?: string },
  industry: IndustryType
): string {
  return navDescriptionOverrides[industry]?.[item.href] ?? item.description ?? '';
}

// --- Terminología de entidades, por rubro (para pantallas internas) ---
export type IndustryTerms = {
  expedienteSingular: string;
  expedientePlural: string;
  partes: string;
  listaEyebrow: string;
  listaTitulo: string;
  listaSubtitulo: string;
  nuevoCta: string;
  itemSinTitulo: string;
  vacioSinResultados: string;
  vacioSinDatos: string;
  vacioAyuda: string;
  // --- Detalle ---
  detalleEyebrow: string;
  datosTitulo: string;
  editarDatos: string;
  actualizarCta: string;
  docsTitulo: string;
  docsSubtitulo: string;
  docsVacio: string;
  copilotoTitulo: string;
  copilotoSubtitulo: string;
  resumenVacio: string;
  // --- Dashboard ---
  dashboardSubtitulo: string;
  // --- Radar de plazos / vigencias ---
  radarTitulo: string;
  radarSubtitulo: string;
  // --- Observaciones / Operacional ---
  observacionesIncompletosCard: string;
  observacionesIncompletosTitulo: string;
  observacionesPlazosCard: string;
  observacionesPlazosTitulo: string;
  observacionesPlazosDesc: string;
  observacionesPlazosVacio: string;
  // --- Dashboard helper ---
  dashboardActivesHelper: string;
  dashboardPlazosHelper: string;
  // --- Reportes ---
  reportesSubtitulo: string;
};

const defaultTerms: IndustryTerms = {
  expedienteSingular: 'Expediente',
  expedientePlural: 'Expedientes',
  partes: 'Partes',
  listaEyebrow: 'EXPEDIENTES',
  listaTitulo: 'Gestión de Casos',
  listaSubtitulo: 'Todos tus casos, clientes, estados y documentación asociada en un único panel.',
  nuevoCta: 'Nuevo expediente',
  itemSinTitulo: 'Expediente sin titulo',
  vacioSinResultados: 'No se encontraron expedientes para',
  vacioSinDatos: 'Todavía no hay expedientes.',
  vacioAyuda: 'Crea el primer expediente para comenzar la gestion documental.',
  detalleEyebrow: 'DETALLE DE EXPEDIENTE',
  datosTitulo: 'Datos del expediente',
  editarDatos: 'Editar datos del expediente',
  actualizarCta: 'Actualizar expediente',
  docsTitulo: 'Documentos del expediente',
  docsSubtitulo: 'Documentos cargados en la bóveda y asociados a este expediente.',
  docsVacio: 'Aún no hay documentos en este expediente.',
  copilotoTitulo: 'Resumen ejecutivo con IA',
  copilotoSubtitulo: 'Síntesis del expediente. Panorama ejecutivo del caso generado por IA a partir de los documentos analizados y las actuaciones.',
  resumenVacio: 'Todavía no hay documentos analizados en este expediente. Analizá al menos un documento con IA para poder generar el resumen.',
  dashboardSubtitulo: 'Tu panel operativo de expedientes, documentos e IA.',
  radarTitulo: 'Radar de plazos',
  radarSubtitulo: 'Plazos vencidos y próximos (hasta 30 días), ordenados por urgencia.',
  observacionesIncompletosCard: 'Incompletos',
  observacionesIncompletosTitulo: 'Casos incompletos',
  observacionesPlazosCard: 'Fechas clave',
  observacionesPlazosTitulo: 'Plazos y fechas clave',
  observacionesPlazosDesc: 'Casos con fechas próximas o vencidas.',
  observacionesPlazosVacio: 'Sin fechas próximas.',
  dashboardActivesHelper: 'Registros actualmente en curso',
  dashboardPlazosHelper: 'Fechas clave próximas o vencidas',
  reportesSubtitulo: 'Análisis y visión de conjunto: métricas, cartera y auditoría para leer el panorama general de la organización.',
};

const termsByIndustry: Partial<Record<IndustryType, IndustryTerms>> = {
  escribania: {
    expedienteSingular: 'Legajo',
    expedientePlural: 'Legajos',
    partes: 'Firmantes',
    listaEyebrow: 'LEGAJOS',
    listaTitulo: 'Gestión de Legajos',
    listaSubtitulo: 'Todos tus legajos, firmantes, estados y documentación asociada en un único panel.',
    nuevoCta: 'Nuevo legajo',
    itemSinTitulo: 'Legajo sin título',
    vacioSinResultados: 'No se encontraron legajos para',
    vacioSinDatos: 'Todavía no hay legajos.',
    vacioAyuda: 'Creá el primer legajo para comenzar la gestión documental.',
    detalleEyebrow: 'DETALLE DE LEGAJO',
    datosTitulo: 'Datos del legajo',
    editarDatos: 'Editar datos del legajo',
    actualizarCta: 'Actualizar legajo',
    docsTitulo: 'Documentos del legajo',
    docsSubtitulo: 'Documentos cargados en la bóveda y asociados a este legajo.',
    docsVacio: 'Aún no hay documentos en este legajo.',
    copilotoTitulo: 'Resumen ejecutivo con IA',
    copilotoSubtitulo: 'Síntesis del legajo. Panorama ejecutivo del legajo generado por IA a partir de los documentos analizados y las actuaciones.',
    resumenVacio: 'Todavía no hay documentos analizados en este legajo. Analizá al menos un documento con IA para poder generar el resumen.',
    dashboardSubtitulo: 'Tu panel operativo de legajos, documentos e IA.',
    radarTitulo: 'Radar de vigencias',
    radarSubtitulo: 'Vigencias de certificados y plazos próximos (hasta 30 días), ordenados por urgencia.',
    observacionesIncompletosCard: 'Leg. incompletos',
    observacionesIncompletosTitulo: 'Legajos incompletos',
    observacionesPlazosCard: 'Fechas clave',
    observacionesPlazosTitulo: 'Fechas clave notariales',
    observacionesPlazosDesc: 'Legajos con fechas próximas o vencidas.',
    observacionesPlazosVacio: 'Sin fechas próximas.',
    dashboardActivesHelper: 'Legajos actualmente en preparación o curso',
    dashboardPlazosHelper: 'Fechas clave y vencimientos',
    reportesSubtitulo: 'Análisis y visión de conjunto: métricas, cartera y auditoría para leer el panorama general de la escribanía.',
  },
  inmobiliaria: {
    expedienteSingular: 'Operación',
    expedientePlural: 'Operaciones',
    partes: 'Partes',
    listaEyebrow: 'OPERACIONES',
    listaTitulo: 'Gestión de Operaciones',
    listaSubtitulo: 'Todas tus operaciones, clientes, estados y documentación asociada en un único panel.',
    nuevoCta: 'Nueva operación',
    itemSinTitulo: 'Operación sin título',
    vacioSinResultados: 'No se encontraron operaciones para',
    vacioSinDatos: 'Todavía no hay operaciones.',
    vacioAyuda: 'Creá la primera operación para comenzar la gestión documental.',
    detalleEyebrow: 'DETALLE DE OPERACIÓN',
    datosTitulo: 'Datos de la operación',
    editarDatos: 'Editar datos de la operación',
    actualizarCta: 'Actualizar operación',
    docsTitulo: 'Documentos de la operación',
    docsSubtitulo: 'Documentos cargados en la bóveda y asociados a esta operación.',
    docsVacio: 'Aún no hay documentos en esta operación.',
    copilotoTitulo: 'Resumen ejecutivo con IA',
    copilotoSubtitulo: 'Síntesis de la operación. Panorama ejecutivo de la operación generado por IA a partir de los documentos analizados y las actuaciones.',
    resumenVacio: 'Todavía no hay documentos analizados en esta operación. Analizá al menos un documento con IA para poder generar el resumen.',
    dashboardSubtitulo: 'Tu panel operativo de operaciones, documentos e IA.',
    radarTitulo: 'Radar de vencimientos',
    radarSubtitulo: 'Vencimientos de documentos y plazos próximos (hasta 30 días), ordenados por urgencia.',
    observacionesIncompletosCard: 'Oper. incompletas',
    observacionesIncompletosTitulo: 'Operaciones incompletas',
    observacionesPlazosCard: 'Fechas clave',
    observacionesPlazosTitulo: 'Fechas clave de operaciones',
    observacionesPlazosDesc: 'Operaciones con fechas próximas o vencidas.',
    observacionesPlazosVacio: 'Sin fechas próximas.',
    dashboardActivesHelper: 'Operaciones actualmente en captación o curso',
    dashboardPlazosHelper: 'Fechas clave y vencimientos',
    reportesSubtitulo: 'Análisis y visión de conjunto: métricas, cartera y auditoría para leer el panorama general de la inmobiliaria.',
  },
  legal: {
    expedienteSingular: 'Expediente',
    expedientePlural: 'Expedientes',
    partes: 'Partes',
    listaEyebrow: 'EXPEDIENTES',
    listaTitulo: 'Gestión de Expedientes',
    listaSubtitulo: 'Todos tus expedientes, clientes, estados procesales y documentación asociada en un único panel.',
    nuevoCta: 'Nuevo expediente',
    itemSinTitulo: 'Expediente sin título',
    vacioSinResultados: 'No se encontraron expedientes para',
    vacioSinDatos: 'Todavía no hay expedientes.',
    vacioAyuda: 'Creá el primer expediente para comenzar la gestión procesal.',
    detalleEyebrow: 'DETALLE DE EXPEDIENTE',
    datosTitulo: 'Datos del expediente',
    editarDatos: 'Editar datos del expediente',
    actualizarCta: 'Actualizar expediente',
    docsTitulo: 'Documentos del expediente',
    docsSubtitulo: 'Documentos cargados en la bóveda y asociados a este expediente.',
    docsVacio: 'Aún no hay documentos en este expediente.',
    copilotoTitulo: 'Resumen ejecutivo con IA',
    copilotoSubtitulo: 'Síntesis del expediente. Panorama ejecutivo del caso generado por IA a partir de los documentos analizados y las actuaciones.',
    resumenVacio: 'Todavía no hay documentos analizados en este expediente. Analizá al menos un documento con IA para poder generar el resumen.',
    dashboardSubtitulo: 'Tu panel operativo de expedientes, plazos procesales, documentos e IA.',
    radarTitulo: 'Radar de plazos',
    radarSubtitulo: 'Plazos procesales vencidos y próximos (hasta 30 días), ordenados por urgencia.',
    observacionesIncompletosCard: 'Exp. incompletos',
    observacionesIncompletosTitulo: 'Expedientes incompletos',
    observacionesPlazosCard: 'Plazos',
    observacionesPlazosTitulo: 'Plazos procesales y fechas clave',
    observacionesPlazosDesc: 'Expedientes con audiencia o plazo próximo o vencido.',
    observacionesPlazosVacio: 'Sin plazos próximos.',
    dashboardActivesHelper: 'Expedientes actualmente en curso',
    dashboardPlazosHelper: 'Audiencias y plazos próximos',
    reportesSubtitulo: 'Análisis y visión de conjunto: métricas, cartera y auditoría para leer el panorama general del estudio.',
  },
};

export function getIndustryTerms(industry: IndustryType): IndustryTerms {
  return termsByIndustry[industry] ?? defaultTerms;
}

export type AgendaLabels = {
  eyebrow: string;
  subtitulo: string;
  plazoLabel: string;
  feriaLabel: string;
};

const agendaLabelsByIndustry: Partial<Record<IndustryType, AgendaLabels>> = {
  legal: {
    eyebrow: 'Herramientas jurídicas',
    subtitulo: 'Feriados, feria judicial y vencimientos de tus documentos y expedientes.',
    plazoLabel: 'Plazo procesal',
    feriaLabel: 'Feria judicial',
  },
  escribania: {
    eyebrow: 'Herramientas notariales',
    subtitulo: 'Feriados, turnos, firmas y vencimientos de certificados y legajos.',
    plazoLabel: 'Plazo / vencimiento',
    feriaLabel: 'Feria judicial',
  },
  inmobiliaria: {
    eyebrow: 'Herramientas inmobiliarias',
    subtitulo: 'Feriados, vencimientos de documentos y fechas clave de tus operaciones.',
    plazoLabel: 'Plazo',
    feriaLabel: 'Feriado extendido',
  },
  empresa: {
    eyebrow: 'Herramientas de gestión',
    subtitulo: 'Feriados, vencimientos de documentos y fechas clave de la organización.',
    plazoLabel: 'Plazo',
    feriaLabel: 'Feriado extendido',
  },
  general: {
    eyebrow: 'Herramientas',
    subtitulo: 'Feriados, vencimientos de documentos y fechas clave.',
    plazoLabel: 'Plazo',
    feriaLabel: 'Feria',
  },
};

export function getAgendaLabels(industry: IndustryType): AgendaLabels {
  return agendaLabelsByIndustry[industry] ?? agendaLabelsByIndustry.legal!;
}
