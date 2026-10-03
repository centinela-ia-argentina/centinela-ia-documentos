// ⚖️ Constantes legales — Justicia Nacional / Federal (Argentina)
// ⚠️ Verificar y actualizar periódicamente.
// Fuentes: argentina.gob.ar/jefatura/feriados-nacionales-2026 · csjn.gov.ar · cpacf.org.ar

// Valor de la UMA (Unidad de Medida Arancelaria) — Ley 27.423
export const UMA_VALOR = 98112; // vigente desde 01/04/2026 (Res. CSJN SGA 1352/2026)
export const UMA_VIGENCIA = '1 de abril de 2026';

// Tasa de justicia (Ley 23.898) — Nación
export const TASA_JUSTICIA_PORCENTAJE = 3; // % del monto del proceso

export type LegalJurisdiction = 'nacion' | 'corrientes' | 'pba';

export const JURISDICTION_LABELS: Record<LegalJurisdiction, string> = {
  nacion: 'Justicia Nacional/Federal',
  corrientes: 'Provincia de Corrientes',
  pba: 'Provincia de Buenos Aires'
};

export interface LegalCalendar {
  jurisdiction: LegalJurisdiction;
  year: number;
  holidays: string[];
  judicialRecesses: Array<{ desde: string; hasta: string; nombre: string }>;
  sourceUrl: string;
  verifiedAt: string;
  coverage: 'verified' | 'unverified';
}

export const FERIADOS_NACIONALES_2026 = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-23', '2026-03-24',
  '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15',
  '2026-06-20', '2026-07-09', '2026-07-10', '2026-08-17', '2026-10-12',
  '2026-11-23', '2026-12-07', '2026-12-08', '2026-12-25',
];

export const LEGAL_CALENDARS: Record<LegalJurisdiction, LegalCalendar> = {
  corrientes: {
    jurisdiction: 'corrientes',
    year: 2026,
    holidays: [...FERIADOS_NACIONALES_2026],
    judicialRecesses: [
      { desde: '2026-01-01', hasta: '2026-01-31', nombre: 'Feria judicial de verano — Corrientes' },
      { desde: '2026-07-11', hasta: '2026-07-26', nombre: 'Feria judicial de invierno — Corrientes (Ac. STJ 17/26)' },
    ],
    sourceUrl: 'https://www.juscorrientes.gov.ar/',
    verifiedAt: '2026-07-30',
    coverage: 'verified'
  },
  nacion: {
    jurisdiction: 'nacion',
    year: 2026,
    holidays: [],
    judicialRecesses: [],
    sourceUrl: '',
    verifiedAt: '',
    coverage: 'unverified'
  },
  pba: {
    jurisdiction: 'pba',
    year: 2026,
    holidays: [],
    judicialRecesses: [],
    sourceUrl: '',
    verifiedAt: '',
    coverage: 'unverified'
  }
};

// ── Honorarios de mediación (valores actualizables mensualmente) ──
// Nación: UHOM (Ley 26.589, Dec. 1467/2011 mod. 2536/2015). $12.960 desde 1/8/2026 (CPACF tabla agosto 2026).
export const UHOM_VALOR = 12960;
// Buenos Aires: Jus arancelario Ley 14.967 (art. 9). $53.232 desde 1/8/2026 (SCBA Res. RP 873/26).
export const JUS_BA_MEDIACION = 53232;
// Corrientes: Jus provincial (STJ). $58.519,61 desde 1/5/2026.
export const JUS_CORRIENTES = 58519.61;

export type ParameterStatus = 'verified' | 'pending' | 'expired' | 'unavailable';

export interface GovernedParameter {
  identifier: string;
  jurisdiction: LegalJurisdiction | string;
  value: number;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  effectiveFrom: string;
  verifiedAt: string;
  lastCheckedAt?: string;
  status: ParameterStatus;
  legalScope: string;
  orientative: boolean;
  label?: string;
  editable?: boolean;
  notes?: string;
  // Compatibilidad con contratos previos
  identificador: string;
  concepto: string;
  jurisdiccion: string;
  valor: number;
  unidad: string;
  vigencia_desde: string;
  fuente: string;
  url: string;
  verification_status: 'verificada' | 'no_verificada' | 'pendiente';
  aplicabilidad_juridica: string;
  caracter_orientativo: boolean;
}

export type LegalParameterConfig = GovernedParameter;

export const LEGAL_PARAMETERS: Record<string, GovernedParameter> = {
  tasa_justicia_nacion: {
    identifier: 'tasa_justicia_nacion',
    jurisdiction: 'nacion',
    value: 3,
    unit: '%',
    sourceName: 'Ley 23.898',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/298/texact.htm',
    effectiveFrom: '1990-10-24',
    verifiedAt: '2026-09-04',
    status: 'verified',
    legalScope: 'Justicia Nacional / Federal en lo Civil y Comercial (pretensión pecuniaria general)',
    orientative: true,
    label: 'Tasa de Justicia Nacional (Ley 23.898)',
    editable: false,
    notes: 'Aplica únicamente a pretensiones pecuniarias generales en Justicia Nacional/Federal.',
    identificador: 'tasa_justicia_nacion',
    concepto: 'Tasa de Justicia Nacional (Ley 23.898)',
    jurisdiccion: 'nacion',
    valor: 3,
    unidad: '%',
    vigencia_desde: '1990-10-24',
    fuente: 'Ley 23.898',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/298/texact.htm',
    verification_status: 'verificada',
    aplicabilidad_juridica: 'Nación/Federal',
    caracter_orientativo: true,
  },
  tasa_justicia_pba: {
    identifier: 'tasa_justicia_pba',
    jurisdiction: 'pba',
    value: 0,
    unit: '%',
    sourceName: 'Código Fiscal PBA / Ley Impositiva PBA',
    sourceUrl: '',
    effectiveFrom: '-',
    verifiedAt: '',
    status: 'unavailable',
    legalScope: 'Provincia de Buenos Aires (cobertura no implementada)',
    orientative: true,
    label: 'Tasa de Justicia PBA',
    editable: false,
    notes: 'Cobertura no implementada.',
    identificador: 'tasa_justicia_pba',
    concepto: 'Tasa de Justicia PBA',
    jurisdiccion: 'pba',
    valor: 0,
    unidad: '%',
    vigencia_desde: '-',
    fuente: 'Código Fiscal PBA',
    url: '',
    verification_status: 'no_verificada',
    aplicabilidad_juridica: 'PBA',
    caracter_orientativo: true,
  },
  tasa_justicia_corrientes: {
    identifier: 'tasa_justicia_corrientes',
    jurisdiction: 'corrientes',
    value: 0,
    unit: '%',
    sourceName: 'Código Fiscal Corrientes / Ley Tarifaria',
    sourceUrl: '',
    effectiveFrom: '-',
    verifiedAt: '',
    status: 'unavailable',
    legalScope: 'Provincia de Corrientes (cobertura no implementada)',
    orientative: true,
    label: 'Tasa de Justicia Corrientes',
    editable: false,
    notes: 'Cobertura no implementada.',
    identificador: 'tasa_justicia_corrientes',
    concepto: 'Tasa de Justicia Corrientes',
    jurisdiccion: 'corrientes',
    valor: 0,
    unidad: '%',
    vigencia_desde: '-',
    fuente: 'Código Fiscal Corrientes',
    url: '',
    verification_status: 'no_verificada',
    aplicabilidad_juridica: 'Corrientes',
    caracter_orientativo: true,
  },
  tasa_activa_bna: {
    identifier: 'tasa_activa_bna',
    jurisdiction: 'nacion',
    value: 27.60,
    unit: '% TNA vencida',
    sourceName: 'Banco de la Nación Argentina',
    sourceUrl: 'https://bna.com.ar/Home/InformacionAlUsuarioFinanciero',
    effectiveFrom: '2026-08-26',
    verifiedAt: '',
    lastCheckedAt: '2026-09-04',
    status: 'pending',
    legalScope: 'Referencia orientativa vigente BNA (cartera general). Requiere ingreso/confirmación manual según criterio judicial aplicable.',
    orientative: true,
    label: 'Tasa Activa Cartera General Diversas BNA',
    editable: true,
    notes: 'TNA vencida de referencia al 26/08/2026. No constituye serie histórica ni aplicación automática obligatoria.',
    identificador: 'tasa_activa_bna',
    concepto: 'Tasa Activa Cartera General Diversas BNA (referencia orientativa)',
    jurisdiccion: 'nacion',
    valor: 27.60,
    unidad: '% TNA vencida',
    vigencia_desde: '2026-08-26',
    fuente: 'Banco de la Nación Argentina',
    url: 'https://bna.com.ar/Home/InformacionAlUsuarioFinanciero',
    verification_status: 'pendiente',
    aplicabilidad_juridica: 'Referencia general sin serie histórica automática',
    caracter_orientativo: true,
  },
  uma: {
    identifier: 'uma',
    jurisdiction: 'nacion',
    value: UMA_VALOR,
    unit: 'ARS',
    sourceName: 'CSJN (Res. SGA 1352/2026)',
    sourceUrl: 'https://www.csjn.gov.ar/novedades/detalle/13685',
    effectiveFrom: '2026-04-01',
    verifiedAt: '2026-09-04',
    lastCheckedAt: '2026-09-04',
    status: 'verified',
    legalScope: 'Honorarios profesionales Ley 27.423 - Justicia Nacional y Federal',
    orientative: true,
    label: 'Unidad de Medida Arancelaria (Ley 27.423)',
    editable: true,
    notes: 'Valor oficial $98.112 vigente desde el 1 de abril de 2026 conforme Resolución SGA 1352/2026 CSJN.',
    identificador: 'uma',
    concepto: 'Unidad de Medida Arancelaria (Ley 27.423)',
    jurisdiccion: 'nacion',
    valor: UMA_VALOR,
    unidad: 'ARS',
    vigencia_desde: UMA_VIGENCIA,
    fuente: 'CSJN Res. SGA 1352/2026',
    url: 'https://www.csjn.gov.ar/novedades/detalle/13685',
    verification_status: 'verificada',
    aplicabilidad_juridica: 'Honorarios Justicia Nacional y Federal',
    caracter_orientativo: true,
  },
  uhom: {
    identifier: 'uhom',
    jurisdiction: 'nacion',
    value: UHOM_VALOR,
    unit: 'ARS',
    sourceName: 'CPACF / Ley 26.589',
    sourceUrl: 'https://www.cpacf.org.ar/uploads/files/com/23062616_CPACF%202026-08%20HONORARIOS%20MEDIACION.pdf',
    effectiveFrom: '2026-08-01',
    verifiedAt: '2026-09-04',
    lastCheckedAt: '2026-09-04',
    status: 'verified',
    legalScope: 'Mediación prejudicial obligatoria Nación (Ley 26.589)',
    orientative: true,
    label: 'Unidad de Honorarios de Mediación (UHOM)',
    editable: true,
    notes: 'Valor oficial $12.960 vigente desde el 1 de agosto de 2026 publicado en tabla CPACF agosto 2026.',
    identificador: 'uhom',
    concepto: 'Unidad de Honorarios de Mediación',
    jurisdiccion: 'nacion',
    valor: UHOM_VALOR,
    unidad: 'ARS',
    vigencia_desde: '2026-08-01',
    fuente: 'CPACF tabla agosto 2026',
    url: 'https://www.cpacf.org.ar/uploads/files/com/23062616_CPACF%202026-08%20HONORARIOS%20MEDIACION.pdf',
    verification_status: 'verificada',
    aplicabilidad_juridica: 'Mediación Nación',
    caracter_orientativo: true,
  },
  jus_pba: {
    identifier: 'jus_pba',
    jurisdiction: 'pba',
    value: JUS_BA_MEDIACION,
    unit: 'ARS',
    sourceName: 'SCBA (Res. RP 873/26) / Ley 14.967',
    sourceUrl: 'https://www.scba.gov.ar/informacion/jus%20-%20documentos/IUS%20agosto%2026.pdf',
    effectiveFrom: '2026-08-01',
    verifiedAt: '2026-09-04',
    lastCheckedAt: '2026-09-04',
    status: 'verified',
    legalScope: 'Mediación prejudicial obligatoria PBA (Ley 13.951) y honorarios profesionales (Ley 14.967)',
    orientative: true,
    label: 'Jus Ley 14.967 PBA',
    editable: true,
    notes: 'Valor arancelario oficial $53.232 vigente desde el 1 de agosto de 2026 según Resolución RP 873/26 SCBA.',
    identificador: 'jus_pba',
    concepto: 'Jus Ley 14.967 PBA',
    jurisdiccion: 'pba',
    valor: JUS_BA_MEDIACION,
    unidad: 'ARS',
    vigencia_desde: '2026-08-01',
    fuente: 'SCBA Res. RP 873/26',
    url: 'https://www.scba.gov.ar/informacion/jus%20-%20documentos/IUS%20agosto%2026.pdf',
    verification_status: 'verificada',
    aplicabilidad_juridica: 'Mediación/Honorarios PBA',
    caracter_orientativo: true,
  },
  jus_corrientes: {
    identifier: 'jus_corrientes',
    jurisdiction: 'corrientes',
    value: JUS_CORRIENTES,
    unit: 'ARS',
    sourceName: 'STJ Corrientes / Ley 5931',
    sourceUrl: 'https://www.juscorrientes.gov.ar/jurisprudencia-y-doctrina/valores-del-jus/',
    effectiveFrom: '2026-05-01',
    verifiedAt: '',
    lastCheckedAt: '2026-09-04',
    status: 'pending',
    legalScope: 'Mediación prejudicial Corrientes (Ley 5931 / Ac. 14/22)',
    orientative: true,
    label: 'Jus Arancelario Corrientes',
    editable: true,
    notes: 'Último valor oficial localizado $58.519,61 vigente desde el 1 de mayo de 2026. Editable por el profesional.',
    identificador: 'jus_corrientes',
    concepto: 'Jus Arancelario Corrientes',
    jurisdiccion: 'corrientes',
    valor: JUS_CORRIENTES,
    unidad: 'ARS',
    vigencia_desde: '2026-05-01',
    fuente: 'STJ Corrientes',
    url: 'https://www.juscorrientes.gov.ar/jurisprudencia-y-doctrina/valores-del-jus/',
    verification_status: 'pendiente',
    aplicabilidad_juridica: 'Mediación/Honorarios Corrientes',
    caracter_orientativo: true,
  },
};

export function getParameterInventory(): GovernedParameter[] {
  return Object.values(LEGAL_PARAMETERS);
}

export function isParameterUsable(param: GovernedParameter): boolean {
  return param.status === 'verified';
}
