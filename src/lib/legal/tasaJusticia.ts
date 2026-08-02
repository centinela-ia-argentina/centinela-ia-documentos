import { LEGAL_PARAMETERS } from './config';

export type NationalJusticeFeeCaseType =
  | 'general_pecuniary'
  | 'succession'
  | 'employment'
  | 'family'
  | 'indeterminate'
  | 'insolvency'
  | 'survey_boundary'
  | 'third_party_claim'
  | 'amparo'
  | 'legal_aid'
  | 'other';

export type ResultadoTasaJusticia =
  | { 
      ok: true; 
      base: number; 
      porcentaje: number; 
      tasa: number;
      jurisdiccion: string;
      fuente_nombre: string;
      fuente_url: string;
      norma: string;
      vigencia: string;
      fecha_calculo: string;
      verification_status: string;
      caracter_orientativo: boolean;
      tipo_proceso?: NationalJusticeFeeCaseType;
      confirmacion_sin_regimen_especial?: boolean;
      advertencia_revision_profesional?: string;
    }
  | { ok: false; motivo: string };

/**
 * Tasa de justicia — Validación por jurisdicción.
 */
export function calcularTasaJusticia(input: {
  monto: number;
  jurisdiccion?: string;
  tipo_proceso?: NationalJusticeFeeCaseType;
  confirmacion?: boolean;
}): ResultadoTasaJusticia {
  if (!input.jurisdiccion) {
    return { ok: false, motivo: 'jurisdiccion_requerida' };
  }
  if (input.jurisdiccion === 'pba' || input.jurisdiccion === 'corrientes') {
    return { ok: false, motivo: 'jurisdiccion_no_verificada' };
  }
  if (input.jurisdiccion !== 'nacion') {
    return { ok: false, motivo: 'Jurisdicción no válida o desconocida.' };
  }
  if (!input.tipo_proceso) {
    return { ok: false, motivo: 'tipo_proceso_requerido' };
  }

  if (input.tipo_proceso === 'succession') {
    return { ok: false, motivo: 'La Ley 23.898 contempla una tasa reducida y reglas específicas sobre la base sucesoria. Esta cobertura todavía no está implementada. No generé un cálculo.' };
  }
  if (input.tipo_proceso === 'employment') {
    return { ok: false, motivo: 'Los trabajadores y causahabientes pueden estar exentos según el artículo 13 de la Ley 23.898, dependiendo del carácter de la parte y del origen del proceso. Requiere revisión profesional. No generé un cálculo.' };
  }
  if (input.tipo_proceso === 'family') {
    return { ok: false, motivo: 'Determinadas actuaciones de familia están exentas y otras pueden tener contenido patrimonial. Requiere revisión profesional. No generé un cálculo.' };
  }
  if (input.tipo_proceso === 'indeterminate') {
    return { ok: false, motivo: 'Los procesos de monto indeterminado o sin contenido pecuniario aplican reglas y montos fijos específicos. Esta cobertura todavía no está implementada.' };
  }
  if (input.tipo_proceso === 'insolvency') {
    return { ok: false, motivo: 'Los procesos concursales tienen una tasa especial. Esta cobertura todavía no está implementada.' };
  }
  if (['survey_boundary', 'third_party_claim', 'amparo', 'legal_aid', 'other'].includes(input.tipo_proceso)) {
    return { ok: false, motivo: 'La Ley 23.898 contempla una solución especial o exención. Esta cobertura todavía no está implementada.' };
  }

  if (input.tipo_proceso !== 'general_pecuniary') {
    return { ok: false, motivo: 'Tipo de proceso no válido.' };
  }

  const base = Number(input.monto);
  if (!Number.isFinite(base) || base <= 0) {
    return { ok: false, motivo: 'El monto del proceso debe ser un número mayor a cero.' };
  }
  if (!input.confirmacion) {
    return { ok: false, motivo: 'Falta confirmar ausencia de régimen especial.' };
  }

  const param = LEGAL_PARAMETERS['tasa_justicia_nacion'];
  const porcentaje = param.valor;
  const tasa = Math.round(base * (porcentaje / 100));

  return { 
    ok: true, 
    base, 
    porcentaje, 
    tasa,
    jurisdiccion: param.jurisdiccion,
    fuente_nombre: param.fuente,
    fuente_url: param.url,
    norma: param.concepto,
    vigencia: param.vigencia_desde,
    fecha_calculo: new Date().toISOString(),
    verification_status: param.verification_status,
    caracter_orientativo: param.caracter_orientativo,
    tipo_proceso: input.tipo_proceso,
    confirmacion_sin_regimen_especial: input.confirmacion,
    advertencia_revision_profesional: 'Sujeto a revisión profesional. Cálculo estimativo.'
  };
}
