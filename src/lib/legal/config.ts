// ⚖️ Constantes legales — Justicia Nacional / Federal (Argentina)
// ⚠️ Verificar y actualizar periódicamente.
// Fuentes: argentina.gob.ar/jefatura/feriados-nacionales-2026 · csjn.gov.ar · cpacf.org.ar

// Valor de la UMA (Unidad de Medida Arancelaria) — Ley 27.423
export const UMA_VALOR = 98112; // vigente desde 01/04/2026 (Res. CSJN 1352/26)
export const UMA_VIGENCIA = 'abril 2026';

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

export const LEGAL_CALENDARS: Record<LegalJurisdiction, LegalCalendar> = {
  corrientes: {
    jurisdiction: 'corrientes',
    year: 2026,
    holidays: [
      '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-23', '2026-03-24',
      '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15',
      '2026-06-20', '2026-07-09', '2026-07-10', '2026-08-17', '2026-10-12',
      '2026-11-23', '2026-12-07', '2026-12-08', '2026-12-25',
    ],
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
// Nación: UHOM (Ley 26.589, Dec. 1467/2011 mod. 2536/2015). $12.150 desde 1/5/2026 (CPACF).
export const UHOM_VALOR = 12150;
// Buenos Aires: Jus arancelario Ley 14.967 (art. 9). $49.750 desde 1/4/2026 (SCBA).
export const JUS_BA_MEDIACION = 49750;
// Corrientes: Jus provincial (STJ). $58.519,61 desde 1/5/2026.
export const JUS_CORRIENTES = 58519.61;

// Tasa activa cartera general del Banco de la Nación Argentina (uso judicial).
// Jurisprudencia STJ Corrientes para daños. Valor vigente a la fecha indicada.
export const TASA_ACTIVA_BNA_TNA = 25.57 // % TNA vencida
export const TASA_ACTIVA_BNA_VIGENCIA = 'julio 2026'
