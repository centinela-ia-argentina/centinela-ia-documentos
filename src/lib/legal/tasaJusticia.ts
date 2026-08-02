import { LEGAL_PARAMETERS } from './config';

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
    }
  | { ok: false; motivo: string };

/**
 * Tasa de justicia — Validación por jurisdicción.
 */
export function calcularTasaJusticia(input: {
  monto: number;
  jurisdiccion?: string;
}): ResultadoTasaJusticia {
  const base = Number(input.monto);
  if (!Number.isFinite(base) || base <= 0) {
    return { ok: false, motivo: 'El monto del proceso debe ser un número mayor a cero.' };
  }
  if (!input.jurisdiccion) {
    return { ok: false, motivo: 'jurisdiccion_requerida' };
  }
  if (input.jurisdiccion === 'pba' || input.jurisdiccion === 'corrientes') {
    return { ok: false, motivo: 'jurisdiccion_no_verificada' };
  }
  if (input.jurisdiccion !== 'nacion') {
    return { ok: false, motivo: 'Jurisdicción no válida o desconocida.' };
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
  };
}
