// src/lib/legal/liquidacion.ts

// Motor de liquidación para el fuero civil y laboral.
// Adaptado a la Ley 20.744 modif. por Ley 27.742, Ley 27.802 y Dec. 407/2026.

// ──────────────────────────────────────────────────────────────────────────
// 1. INCAPACIDAD SOBREVINIENTE (Vuoto / Méndez)
// ──────────────────────────────────────────────────────────────────────────

export type MetodoIncapacidad = 'mendez' | 'vuoto';

export interface IncapacidadInput {
  metodo: MetodoIncapacidad;
  ingresoMensual: number; // $ mensual
  edad: number; // años al momento del hecho
  incapacidad: number; // porcentaje 0-100
}

export interface IncapacidadResult {
  ok: boolean;
  motivo?: string;
  metodo: MetodoIncapacidad;
  capital: number;
  ingresoAnualAjustado: number;
  aniosComputables: number;
  tasaDescuento: number;
  advertencia?: string;
}

export function calcularIncapacidad(input: IncapacidadInput): IncapacidadResult {
  const metodo = input.metodo;
  const ing = Number(input.ingresoMensual);
  const ed = Math.trunc(Number(input.edad));
  const inc = Number(input.incapacidad) / 100;
  const base = {
    metodo,
    capital: 0,
    ingresoAnualAjustado: 0,
    aniosComputables: 0,
    tasaDescuento: 0,
    advertencia: 'Capital matemático orientativo. Entiendo que la fórmula no reemplaza la valoración integral del art. 1746 CCyCN ni el criterio judicial aplicable.',
  };
  if (!Number.isFinite(ing) || ing <= 0)
    return { ...base, ok: false, motivo: 'ingreso_invalido' };
  if (!Number.isFinite(ed) || ed <= 0)
    return { ...base, ok: false, motivo: 'edad_invalida' };
  if (!Number.isFinite(inc) || inc <= 0 || inc > 1)
    return { ...base, ok: false, motivo: 'incapacidad_invalida' };

  const i = metodo === 'mendez' ? 0.04 : 0.06;
  const tope = metodo === 'mendez' ? 75 : 65;
  const n = tope - ed;
  if (n <= 0)
    return { ...base, tasaDescuento: i, ok: false, motivo: 'edad_supera_tope' };

  let a = ing * 13 * inc;
  if (metodo === 'mendez') a = a * (60 / ed);
  const Vn = 1 / Math.pow(1 + i, n);
  const capital = (a * (1 - Vn)) / i;

  return {
    ok: true,
    metodo,
    capital,
    ingresoAnualAjustado: a,
    aniosComputables: n,
    tasaDescuento: i,
    advertencia: 'Capital matemático orientativo. Entiendo que la fórmula no reemplaza la valoración integral del art. 1746 CCyCN ni el criterio judicial aplicable.',
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. INTERESES MORATORIOS
// ──────────────────────────────────────────────────────────────────────────

export interface InteresesMoratoriosResult {
  ok: boolean;
  motivo?: string;
  dias: number;
  tasaAnual: number;
  fechaDesde: string;
  fechaHasta: string;
  interes: number;
  total: number;
}

export function calcularInteresesMoratorios(args: {
  capital: number;
  fechaDesde: string;
  fechaHasta?: string;
  tasaAnual?: number;
}): InteresesMoratoriosResult {
  const capital = Number(args.capital);
  const fechaHasta = args.fechaHasta ?? new Date().toISOString().slice(0, 10);
  const fechaDesde = args.fechaDesde;
  return {
    ok: false,
    motivo: 'Motor bloqueado: requiere serie histórica oficial. No se puede calcular retroactivamente con tasa fija.',
    dias: 0,
    tasaAnual: 0,
    fechaDesde: fechaDesde ?? '',
    fechaHasta,
    interes: 0,
    total: Number.isFinite(capital) ? capital : 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. LIQUIDACIÓN LABORAL (LCT Ley 20.744 modif. Ley 27.742, Ley 27.802 y Dec. 407/2026)
// ──────────────────────────────────────────────────────────────────────────

export type RegimenLaboral = 'lct_general' | 'fondo_cese';
export type PlazoPeriodoPrueba = 6 | 8 | 12;

export interface LiquidacionLaboralInput {
  remuneracion: number;
  fechaIngreso: string | Date;
  fechaEgreso: string | Date;
  regimen?: RegimenLaboral;
  cctFondoCese?: string;
  plazoPeriodoPruebaMeses?: PlazoPeriodoPrueba;
  renunciaOPerdidaPeriodoPrueba?: boolean;
  periodoPruebaConcluido?: boolean;
  huboPreaviso?: boolean;
  correspondeIntegracion?: boolean;
}

export interface LiquidacionLaboralResultado {
  anios: number;
  meses: number;
  dias: number;
  enPeriodoPrueba: boolean;
  plazoPeriodoPruebaAplicado: number;
  renuncioPeriodoPrueba: boolean;
  esFondoCese: boolean;
  cctFondoCese?: string;
  huboPreaviso: boolean;
  correspondeIntegracion: boolean;
  aniosComputablesArt245: number;
  indemnizacionAntiguedad: number;
  preavisoBase: number;
  sacSobrePreaviso: number;
  preavisoTotal: number;
  integracionBase: number;
  sacSobreIntegracion: number;
  integracionTotal: number;
  sacProporcional: number;
  vacacionesBase: number;
  sacSobreVacaciones: number;
  vacacionesNoGozadas: number;
  subtotalRubrosComunes: number;
  total: number;
  esUltimoDiaMes: boolean;
  diasVacacionesEscala: number;
  advertencias: string[];
}

/**
 * Valida de forma estricta una fecha calendario evitando normalizaciones automáticas
 * (ej: rechaza 2026-02-31 o 2026-04-31).
 */
export function parseDateStrict(strOrDate: string | Date): Date {
  if (strOrDate instanceof Date) {
    if (isNaN(strOrDate.getTime())) {
      throw new Error('Fecha inválida.');
    }
    return new Date(strOrDate.getFullYear(), strOrDate.getMonth(), strOrDate.getDate());
  }

  if (typeof strOrDate !== 'string') {
    throw new Error('Formato de fecha inválido.');
  }

  const trimmed = strOrDate.trim().split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error(`Formato de fecha inválido: "${strOrDate}". Debe ser AAAA-MM-DD.`);
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  if (m < 1 || m > 12) {
    throw new Error(`Mes calendario inválido (${m}) en la fecha "${strOrDate}".`);
  }

  const maxDays = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDays) {
    throw new Error(`El día ${d} no existe en el mes ${m} del año ${y} (el mes tiene ${maxDays} días).`);
  }

  return new Date(y, m - 1, d);
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function calcularAntiguedadExacta(dIng: Date, dEg: Date): { anios: number; meses: number; dias: number } {
  let anios = dEg.getFullYear() - dIng.getFullYear();
  let meses = dEg.getMonth() - dIng.getMonth();
  let dias = dEg.getDate() - dIng.getDate();

  if (dias < 0) {
    const diasMesAnterior = new Date(dEg.getFullYear(), dEg.getMonth(), 0).getDate();
    dias += diasMesAnterior;
    meses -= 1;
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios, meses, dias };
}

export function calcularLiquidacionLaboral(input: LiquidacionLaboralInput): LiquidacionLaboralResultado {
  const base = input.remuneracion;
  if (!Number.isFinite(base) || base <= 0) {
    throw new Error('La remuneración base debe ser un número positivo.');
  }

  const dIng = parseDateStrict(input.fechaIngreso);
  const dEg = parseDateStrict(input.fechaEgreso);

  if (dEg.getTime() <= dIng.getTime()) {
    throw new Error('La fecha de egreso debe ser posterior a la fecha de ingreso.');
  }

  const { anios, meses, dias } = calcularAntiguedadExacta(dIng, dEg);
  const regimen = input.regimen ?? 'lct_general';
  const esFondoCese = regimen === 'fondo_cese';
  const plazoPeriodoPrueba = input.plazoPeriodoPruebaMeses ?? 6;
  const renuncioPeriodoPrueba = Boolean(input.renunciaOPerdidaPeriodoPrueba);

  // Determinación de período de prueba (art. 92 bis LCT modif. Ley 27.742 / Ley 27.802):
  // Plazo general: 6 meses; CCT: 8 o 12 meses.
  let enPeriodoPrueba = false;
  if (!renuncioPeriodoPrueba) {
    if (input.periodoPruebaConcluido !== undefined) {
      enPeriodoPrueba = !input.periodoPruebaConcluido;
    } else {
      enPeriodoPrueba = anios === 0 && (meses < plazoPeriodoPrueba || (meses === plazoPeriodoPrueba && dias === 0));
    }
  }

  const huboPreaviso = Boolean(input.huboPreaviso);
  const diasEnMesEgreso = new Date(dEg.getFullYear(), dEg.getMonth() + 1, 0).getDate();
  const esUltimoDiaMes = dEg.getDate() === diasEnMesEgreso;

  const advertencias: string[] = [];

  if (renuncioPeriodoPrueba) {
    advertencias.push('Se computa renuncia o pérdida del período de prueba por parte del empleador (art. 92 bis LCT).');
  }

  // 1. Indemnización por antigüedad (art. 245 LCT)
  let aniosComputablesArt245 = 0;
  let indemnizacionAntiguedad = 0;

  if (esFondoCese) {
    advertencias.push(
      'Fondo o sistema de cese laboral (CCT): el importe sustitutivo del art. 245 LCT no forma parte de esta liquidación básica y debe liquidarse según las pautas y aportes del CCT correspondiente.'
    );
  } else if (enPeriodoPrueba) {
    advertencias.push(
      `Extinción durante período de prueba (${plazoPeriodoPrueba} meses, art. 92 bis LCT modif.): no corresponde indemnización por antigüedad (art. 245), sin preaviso (art. 231 modif.) ni integración (art. 233).`
    );
  } else {
    // Fracción mayor de 3 meses para computar un año más
    const fraccionMayor3Meses = meses > 3 || (meses === 3 && dias > 0);
    aniosComputablesArt245 = Math.max(1, anios + (fraccionMayor3Meses ? 1 : 0));
    indemnizacionAntiguedad = base * aniosComputablesArt245;
  }

  // 2. Preaviso (arts. 231 y 232 LCT modif. Ley 27.742 / 27.802)
  let preavisoBase = 0;
  let sacSobrePreaviso = 0;
  let preavisoTotal = 0;

  // Durante período de prueba ya NO rige preaviso de 15 días (eliminado por ley vigente)
  if (!huboPreaviso && !enPeriodoPrueba) {
    const preavisoMeses = anios >= 5 ? 2 : 1;
    preavisoBase = base * preavisoMeses;
    sacSobrePreaviso = preavisoBase / 12;
    preavisoTotal = preavisoBase + sacSobrePreaviso;
  }

  // 3. Integración mes de despido (art. 233 LCT)
  let integracionBase = 0;
  let sacSobreIntegracion = 0;
  let integracionTotal = 0;

  const correspondeIntegracion =
    input.correspondeIntegracion !== false && !huboPreaviso && !esUltimoDiaMes && !enPeriodoPrueba;

  if (correspondeIntegracion) {
    const diasRestantes = diasEnMesEgreso - dEg.getDate();
    integracionBase = (base / diasEnMesEgreso) * diasRestantes;
    sacSobreIntegracion = integracionBase / 12;
    integracionTotal = integracionBase + sacSobreIntegracion;
  }

  // 4. SAC proporcional (art. 123 LCT)
  const inicioSemestre =
    dEg.getMonth() < 6
      ? new Date(dEg.getFullYear(), 0, 1)
      : new Date(dEg.getFullYear(), 6, 1);
  const inicioComputoSemestre = dIng > inicioSemestre ? dIng : inicioSemestre;
  const diasSemestre = Math.max(1, Math.round((dEg.getTime() - inicioComputoSemestre.getTime()) / 86400000) + 1);
  const diasTotalesSemestre = dEg.getMonth() < 6
    ? (esBisiesto(dEg.getFullYear()) ? 182 : 181)
    : 184;
  const sacProporcional = (base / 2) * (Math.min(diasSemestre, diasTotalesSemestre) / diasTotalesSemestre);

  // 5. Vacaciones no gozadas (art. 156 LCT)
  const diasVacacionesEscala = anios >= 20 ? 35 : anios >= 10 ? 28 : anios >= 5 ? 21 : 14;
  const inicioAnio = new Date(dEg.getFullYear(), 0, 1);
  const inicioComputoAnio = dIng > inicioAnio ? dIng : inicioAnio;
  const diasAnioTrabajados = Math.max(1, Math.round((dEg.getTime() - inicioComputoAnio.getTime()) / 86400000) + 1);
  const diasTotalesAnio = esBisiesto(dEg.getFullYear()) ? 366 : 365;

  const vacacionesBase = (base / 25) * (diasVacacionesEscala * (Math.min(diasAnioTrabajados, diasTotalesAnio) / diasTotalesAnio));
  const sacSobreVacaciones = vacacionesBase / 12;
  const vacacionesNoGozadas = vacacionesBase + sacSobreVacaciones;

  // Subtotal de rubros comunes (rubros laborales no sustituidos por el fondo de cese)
  const subtotalRubrosComunes = preavisoTotal + integracionTotal + sacProporcional + vacacionesNoGozadas;
  const total = esFondoCese
    ? subtotalRubrosComunes
    : indemnizacionAntiguedad + subtotalRubrosComunes;

  return {
    anios,
    meses,
    dias,
    enPeriodoPrueba,
    plazoPeriodoPruebaAplicado: plazoPeriodoPrueba,
    renuncioPeriodoPrueba,
    esFondoCese,
    cctFondoCese: input.cctFondoCese,
    huboPreaviso,
    correspondeIntegracion,
    aniosComputablesArt245,
    indemnizacionAntiguedad,
    preavisoBase,
    sacSobrePreaviso,
    preavisoTotal,
    integracionBase,
    sacSobreIntegracion,
    integracionTotal,
    sacProporcional,
    vacacionesBase,
    sacSobreVacaciones,
    vacacionesNoGozadas,
    subtotalRubrosComunes,
    total,
    esUltimoDiaMes,
    diasVacacionesEscala,
    advertencias,
  };
}
