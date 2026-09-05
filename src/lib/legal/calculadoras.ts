// ⚖️ Funciones productivas de cálculo jurídico orientativo
// Todas las funciones respetan la normativa vigente y garantizan trazabilidad.

import { UMA_VALOR, UHOM_VALOR, JUS_BA_MEDIACION, JUS_CORRIENTES } from './config';
export { calcularLiquidacionLaboral, calcularAntiguedadExacta, esBisiesto } from './liquidacion';
export type { LiquidacionLaboralInput, LiquidacionLaboralResultado, RegimenLaboral } from './liquidacion';

// ============================================================================
// 1. CADUCIDAD DE INSTANCIA (Art. 310 CPCCN)
// ============================================================================

export type CaducidadTipo =
  | 'primera'
  | 'segunda'
  | 'sumarisimo_ejecucion_incidentes'
  | 'incidente_caducidad'
  | 'prescripcion_menor';

export interface CaducidadInput {
  fechaUltimoActo: string | Date;
  tipo: CaducidadTipo;
  mesesPrescripcionMenor?: number;
}

export interface CaducidadResultado {
  fechaBaseEstimada: Date;
  fechaBaseEstimadaISO: string;
  meses: number;
  norma: string;
  detalle: string;
  aviso: string;
}

/**
 * Suma meses controlando fin de mes para evitar salto no deseado (ej: 31 ene + 1 mes = 28/29 feb).
 */
export function sumarMesesControlado(fecha: Date, meses: number): Date {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth();
  const dia = fecha.getDate();

  const totalMeses = mes + meses;
  const targetAnio = anio + Math.floor(totalMeses / 12);
  const targetMes = ((totalMeses % 12) + 12) % 12;

  const diasEnMesDestino = new Date(targetAnio, targetMes + 1, 0).getDate();
  const targetDia = Math.min(dia, diasEnMesDestino);

  return new Date(targetAnio, targetMes, targetDia);
}

export function calcularCaducidadBase(input: CaducidadInput): CaducidadResultado {
  const d = typeof input.fechaUltimoActo === 'string'
    ? new Date(
        Number(input.fechaUltimoActo.split('-')[0]),
        Number(input.fechaUltimoActo.split('-')[1]) - 1,
        Number(input.fechaUltimoActo.split('-')[2])
      )
    : new Date(input.fechaUltimoActo.getFullYear(), input.fechaUltimoActo.getMonth(), input.fechaUltimoActo.getDate());

  if (isNaN(d.getTime())) {
    throw new Error('Fecha del último acto de impulso inválida.');
  }

  let meses = 6;
  let norma = 'Art. 310 inc. 1 CPCCN';
  let detalle = '1ª o única instancia';

  if (input.tipo === 'segunda') {
    meses = 3;
    norma = 'Art. 310 inc. 2 CPCCN';
    detalle = '2ª o ulterior instancia';
  } else if (input.tipo === 'sumarisimo_ejecucion_incidentes') {
    meses = 3;
    norma = 'Art. 310 inc. 2 CPCCN';
    detalle = 'Incidentes generales, ejecuciones especiales y juicio sumarísimo';
  } else if (input.tipo === 'incidente_caducidad') {
    meses = 1;
    norma = 'Art. 310 inc. 4 CPCCN';
    detalle = 'Incidente de caducidad de instancia';
  } else if (input.tipo === 'prescripcion_menor') {
    meses = input.mesesPrescripcionMenor && input.mesesPrescripcionMenor > 0 ? input.mesesPrescripcionMenor : 3;
    norma = 'Art. 310 inc. 3 CPCCN';
    detalle = 'Plazo de prescripción de la acción cuando resulte menor';
  }

  const fechaBaseEstimada = sumarMesesControlado(d, meses);
  const y = fechaBaseEstimada.getFullYear();
  const m = String(fechaBaseEstimada.getMonth() + 1).padStart(2, '0');
  const day = String(fechaBaseEstimada.getDate()).padStart(2, '0');
  const fechaBaseEstimadaISO = `${y}-${m}-${day}`;

  return {
    fechaBaseEstimada,
    fechaBaseEstimadaISO,
    meses,
    norma,
    detalle,
    aviso: 'Fecha base aritmética, sin ajuste por feria judicial, suspensión, interrupción ni particularidades del expediente',
  };
}

// ============================================================================
// 2. HONORARIOS LEY 27.423 (Escala Art. 21)
// ============================================================================

export interface TramoArt21Config {
  hastaUMA: number;
  minPct: number;
  maxPct: number;
  acumuladoMaxAnterior: number;
}

// Puntos de corte y continuidad del Art. 21 Ley 27.423
// Cada grado respeta el máximo acumulado del grado anterior y aplica sobre el excedente la alícuota del nuevo tramo.
export const TRAMOS_ART21: Array<{
  desdeUMA: number;
  hastaUMA: number;
  minPct: number;
  maxPct: number;
  maxAcumuladoAnterior: number;
}> = [
  { desdeUMA: 0, hastaUMA: 15, minPct: 22, maxPct: 33, maxAcumuladoAnterior: 0 },
  { desdeUMA: 15, hastaUMA: 45, minPct: 20, maxPct: 26, maxAcumuladoAnterior: 15 * 0.33 }, // 4.95
  { desdeUMA: 45, hastaUMA: 90, minPct: 18, maxPct: 23, maxAcumuladoAnterior: 4.95 + 30 * 0.26 }, // 12.75
  { desdeUMA: 90, hastaUMA: 150, minPct: 17, maxPct: 20, maxAcumuladoAnterior: 12.75 + 45 * 0.23 }, // 23.10
  { desdeUMA: 150, hastaUMA: 450, minPct: 15, maxPct: 18, maxAcumuladoAnterior: 23.10 + 60 * 0.20 }, // 35.10
  { desdeUMA: 450, hastaUMA: 750, minPct: 13, maxPct: 15, maxAcumuladoAnterior: 35.10 + 300 * 0.18 }, // 89.10
  { desdeUMA: 750, hastaUMA: Infinity, minPct: 11, maxPct: 12, maxAcumuladoAnterior: 89.10 + 300 * 0.15 }, // 134.10
];

export interface EscalaArt21Resultado {
  montoUMA: number;
  hMinUMA: number;
  hMaxUMA: number;
  hMinPesos: number;
  hMaxPesos: number;
  hMin: number; // compatibilidad
  hMax: number; // compatibilidad
  tramoMin: number;
  tramoMax: number;
}

export function calcularEscalaArt21(montoPesos: number, valorUMA: number = UMA_VALOR): EscalaArt21Resultado {
  if (!Number.isFinite(montoPesos) || montoPesos <= 0) {
    throw new Error('El monto del proceso debe ser un número positivo.');
  }
  if (!Number.isFinite(valorUMA) || valorUMA <= 0) {
    throw new Error('El valor de la UMA debe ser un número positivo.');
  }

  // No se descartan automáticamente fracciones de UMA
  const montoUMA = montoPesos / valorUMA;

  let hMinUMA = 0;
  let hMaxUMA = 0;
  let tramoMin = 22;
  let tramoMax = 33;

  for (const tramo of TRAMOS_ART21) {
    if (montoUMA <= tramo.hastaUMA) {
      tramoMin = tramo.minPct;
      tramoMax = tramo.maxPct;
      if (tramo.desdeUMA === 0) {
        // Primer tramo según rango propio
        hMinUMA = montoUMA * (tramo.minPct / 100);
        hMaxUMA = montoUMA * (tramo.maxPct / 100);
      } else {
        // Grados posteriores: respetar el máximo del grado anterior y aplicar alícuota sobre el excedente
        const excedente = montoUMA - tramo.desdeUMA;
        hMinUMA = tramo.maxAcumuladoAnterior + excedente * (tramo.minPct / 100);
        hMaxUMA = tramo.maxAcumuladoAnterior + excedente * (tramo.maxPct / 100);
      }
      break;
    }
  }

  const hMinPesos = hMinUMA * valorUMA;
  const hMaxPesos = hMaxUMA * valorUMA;

  return {
    montoUMA,
    hMinUMA,
    hMaxUMA,
    hMinPesos,
    hMaxPesos,
    hMin: hMinPesos,
    hMax: hMaxPesos,
    tramoMin,
    tramoMax,
  };
}

// ============================================================================
// 3. DAÑOS PUNITIVOS (Fórmula Irigoyen Testa)
// ============================================================================

export interface DanosPunitivosResultado {
  compensatoria: number;
  probabilidad: number;
  punitivo: number;
  total: number;
  advertencia: string;
}

export function calcularDanosPunitivos(compensatoria: number, probabilidad: number): DanosPunitivosResultado {
  if (!Number.isFinite(compensatoria) || compensatoria <= 0) {
    throw new Error('La indemnización compensatoria debe ser un número positivo.');
  }
  if (!Number.isFinite(probabilidad) || probabilidad <= 0 || probabilidad > 1) {
    throw new Error('La probabilidad de condena debe ser mayor a 0 y menor o igual a 1 (100%).');
  }

  // D = C * (1 - Pc) / Pc
  const punitivo = compensatoria * ((1 - probabilidad) / probabilidad);
  const total = compensatoria + punitivo;

  return {
    compensatoria,
    probabilidad,
    punitivo,
    total,
    advertencia: 'Simulación doctrinal — fórmula Irigoyen Testa. El art. 52 bis de la Ley 24.240 no establece esta fórmula como método obligatorio de cuantificación.',
  };
}

// ============================================================================
// 4. INCAPACIDAD SOBREVINIENTE (Vuoto / Méndez)
// ============================================================================

export interface IncapacidadResultado {
  capital: number;
  a: number;
  n: number;
  i: number;
  metodo: 'vuoto' | 'mendez';
  advertencia: string;
}

export function calcularIncapacidad(
  metodo: 'vuoto' | 'mendez',
  ingresoMensual: number,
  edad: number,
  porcentajeIncapacidad: number
): IncapacidadResultado {
  if (!Number.isFinite(ingresoMensual) || ingresoMensual <= 0) {
    throw new Error('El ingreso mensual debe ser un número positivo.');
  }
  if (!Number.isFinite(edad) || edad <= 0) {
    throw new Error('La edad debe ser mayor a 0.');
  }
  if (!Number.isFinite(porcentajeIncapacidad) || porcentajeIncapacidad <= 0 || porcentajeIncapacidad > 1) {
    throw new Error('El porcentaje de incapacidad debe ser mayor a 0 y hasta 1 (100%).');
  }

  const i = metodo === 'mendez' ? 0.04 : 0.06;
  const tope = metodo === 'mendez' ? 75 : 65;
  const n = tope - edad;
  if (n <= 0) {
    throw new Error(`La edad (${edad}) supera o iguala la edad límite (${tope}) del método seleccionado.`);
  }

  let a = ingresoMensual * 13 * porcentajeIncapacidad;
  if (metodo === 'mendez') {
    a = a * (60 / edad);
  }

  const vn = 1 / Math.pow(1 + i, n);
  const capital = a * (1 - vn) / i;

  return {
    capital,
    a,
    n,
    i,
    metodo,
    advertencia: 'Capital matemático orientativo. Entiendo que la fórmula no reemplaza la valoración integral del art. 1746 CCyCN ni el criterio judicial aplicable.',
  };
}

// ============================================================================
// 5. PRORRATEO DE HONORARIOS (Tope 25% Art. 730 CCyCN)
// ============================================================================

export interface ProrrateoResultado {
  montoSentencia: number;
  totalHonorarios: number;
  tope25: number;
  excedeTope: boolean;
  factorProrrateo: number;
  aCargoCondenado: number;
  excedente: number;
  notaExcedente: string;
}

export function calcularProrrateo(montoSentencia: number, totalHonorarios: number): ProrrateoResultado {
  if (!Number.isFinite(montoSentencia) || montoSentencia <= 0) {
    throw new Error('El monto de la sentencia debe ser positivo.');
  }
  if (!Number.isFinite(totalHonorarios) || totalHonorarios <= 0) {
    throw new Error('La suma total de honorarios debe ser positiva.');
  }

  const tope25 = montoSentencia * 0.25;
  const excedeTope = totalHonorarios > tope25;
  const factorProrrateo = excedeTope ? tope25 / totalHonorarios : 1;
  const aCargoCondenado = excedeTope ? tope25 : totalHonorarios;
  const excedente = excedeTope ? totalHonorarios - tope25 : 0;

  return {
    montoSentencia,
    totalHonorarios,
    tope25,
    excedeTope,
    factorProrrateo,
    aCargoCondenado,
    excedente,
    notaExcedente: 'El alcance del excedente y la eventual obligación frente al profesional requieren analizar la relación contractual, los conceptos regulados y la normativa aplicable.',
  };
}

// ============================================================================
// 6. MEDIACIÓN PREJUDICIAL (Nación · PBA · Corrientes)
// ============================================================================

export type TipoMediacionNacion = 'patrimonial' | 'familia' | 'indeterminable' | 'sin_valor';

export function calcMediacionNacion(o: {
  tipo: TipoMediacionNacion;
  monto: number;
  audiencias: number;
  valorUHOM?: number;
}) {
  const valorUHOM = o.valorUHOM ?? UHOM_VALOR;
  const { tipo, monto, audiencias } = o;
  let item = '';
  let basicoUHOM = 0;

  if (tipo === 'familia') {
    item = 'Familia (art. 31 b/c)';
    basicoUHOM = 9;
  } else if (tipo === 'indeterminable') {
    item = 'H (indeterminable)';
    basicoUHOM = 20;
  } else if (tipo === 'sin_valor') {
    item = 'I (sin valor pecuniario)';
    basicoUHOM = 12;
  } else {
    const u = monto / valorUHOM;
    if (u <= 30) { item = 'A'; basicoUHOM = 3; }
    else if (u <= 60) { item = 'B'; basicoUHOM = 6; }
    else if (u <= 150) { item = 'C'; basicoUHOM = 9; }
    else if (u <= 300) { item = 'D'; basicoUHOM = 12; }
    else if (u <= 600) { item = 'E'; basicoUHOM = 16; }
    else if (u <= 1000) { item = 'F'; basicoUHOM = 20; }
    else {
      item = 'G (2% con tope 120 UHOM)';
      basicoUHOM = Math.min(0.02 * monto, 120 * valorUHOM) / valorUHOM;
    }
  }

  const basicoPesos = basicoUHOM * valorUHOM;
  const adicUHOM = tipo === 'familia'
    ? Math.max(0, audiencias - 1) * 1
    : Math.max(0, audiencias - 3) * (item === 'A' || item === 'B' ? 0.5 : 1);
  const adicPesos = adicUHOM * valorUHOM;

  return {
    item,
    basicoUHOM,
    basicoPesos,
    adicUHOM,
    adicPesos,
    provisionalPesos: 2 * valorUHOM,
    totalPesos: basicoPesos + adicPesos,
  };
}

export function calcMediacionBA(o: {
  monto: number;
  indeterminado: boolean;
  valorJus?: number;
}) {
  const valorJus = o.valorJus ?? JUS_BA_MEDIACION;
  const { monto, indeterminado } = o;
  let tramo = '';
  let honJus = 0;

  if (indeterminado) {
    tramo = 'Monto indeterminado (art. 31 Dec. 600/21)';
    honJus = 8.69;
  } else {
    const j = monto / valorJus;
    if (j <= 32.07) { tramo = 'a'; honJus = 2.18; }
    else if (j <= 79.80) { tramo = 'b'; honJus = 7.31; }
    else if (j <= 159.60) { tramo = 'c'; honJus = 13.04; }
    else if (j <= 319.20) { tramo = 'd'; honJus = 20.87; }
    else if (j <= 638.41) { tramo = 'e'; honJus = 31.31; }
    else if (j <= 1112.32) { tramo = 'f'; honJus = 47.70; }
    else {
      tramo = 'g';
      honJus = 47.70 + Math.ceil((j - 1112.32) / 79.80) * 4.37;
    }
  }

  return {
    tramo,
    honJus,
    honPesos: honJus * valorJus,
    anticipoJus: 1,
    anticipoPesos: valorJus,
    norma: 'Ley 13.951 y Decreto 600/21 art. 31 (Jus Ley 14.967 PBA)',
  };
}

export type ResultadoMediacionCtes = 'acuerdo' | 'sin_acuerdo';
export type TipoMediacionCtes = 'patrimonial' | 'alimentaria' | 'sin_valor';

export function calcMediacionCorrientes(o: {
  resultado: ResultadoMediacionCtes;
  tipo: TipoMediacionCtes;
  monto: number;
  cuotaMensual: number;
  valorJus?: number;
}) {
  const valorJus = o.valorJus ?? JUS_CORRIENTES;
  const { resultado, tipo, monto, cuotaMensual } = o;
  const pct = resultado === 'acuerdo' ? 0.05 : 0.025;
  let honPesos = 0;
  let detalle = '';
  let aplicaMinimo = false;

  if (tipo === 'sin_valor') {
    const jus = resultado === 'acuerdo' ? 4 : 2;
    honPesos = jus * valorJus;
    detalle = `${jus} Jus (sin contenido patrimonial / monto indeterminado)`;
  } else {
    const base = tipo === 'alimentaria' ? cuotaMensual * 12 : monto;
    honPesos = base * pct;
    detalle = `${pct * 100}% sobre ${tipo === 'alimentaria' ? 'la cuota × 12' : 'el monto'}`;
    if (resultado === 'acuerdo' && honPesos < valorJus) {
      honPesos = valorJus;
      aplicaMinimo = true;
    }
  }

  return {
    honPesos,
    honJus: honPesos / valorJus,
    detalle,
    aplicaMinimo,
    norma: 'Ley 5931 y Acuerdo STJ Corrientes 14/22 (art. 18 RIM)',
  };
}

export type MediacionJurisdiccion = 'nacion' | 'pba' | 'corrientes';

export function calcularMediacion(params:
  | { jurisdiccion: 'nacion'; tipo: TipoMediacionNacion; monto: number; audiencias: number; valorUHOM?: number }
  | { jurisdiccion: 'pba'; monto: number; indeterminado: boolean; valorJus?: number }
  | { jurisdiccion: 'corrientes'; resultado: ResultadoMediacionCtes; tipo: TipoMediacionCtes; monto: number; cuotaMensual: number; valorJus?: number }
) {
  if (params.jurisdiccion === 'nacion') {
    return calcMediacionNacion(params);
  } else if (params.jurisdiccion === 'pba') {
    return calcMediacionBA(params);
  } else {
    return calcMediacionCorrientes(params);
  }
}
