/**
 * Motor de cálculo para el Impuesto de Sellos Notarial / Inmobiliario.
 * Conforme a la legislación fiscal (ej. Código Fiscal CABA art. 268 y normas provinciales),
 * el impuesto se liquida sobre el mayor valor entre el precio de la operación y la valuación fiscal / base imponible.
 */

export interface CalcularSellosInput {
  precio?: number | string | null;
  valuacionFiscal?: number | string | null;
  alicuota?: number | string | null; // porcentaje (ej: 3.6)
  dividirPartes?: boolean;
}

export type BaseUtilizadaSellos = 'precio' | 'valuacion_fiscal' | 'iguales';

export interface CalcularSellosResult {
  precio: number;
  valuacionFiscal: number;
  baseImponible: number;
  baseUtilizada: BaseUtilizadaSellos;
  alicuotaPorcentaje: number;
  sellosTotal: number;
  aCargoCadaParte: number;
  explicacionBase: string;
}

function parseMontoSellos(val: number | string | null | undefined, nombreCampo: string): number {
  if (val === null || val === undefined || val === '') {
    return 0;
  }
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const clean = val.trim().replace(/\$/g, '').replace(/\s/g, '');
    if (clean === '') return 0;
    // Soportar coma o punto decimal
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        num = Number(clean.replace(/\./g, '').replace(',', '.'));
      } else {
        num = Number(clean.replace(/,/g, ''));
      }
    } else if (clean.includes(',')) {
      num = Number(clean.replace(',', '.'));
    } else {
      num = Number(clean);
    }
  }

  if (!Number.isFinite(num)) {
    throw new Error(`El valor ingresado en ${nombreCampo} debe ser un número finito válido.`);
  }
  if (num < 0) {
    throw new Error(`El valor ingresado en ${nombreCampo} no puede ser negativo.`);
  }

  return num;
}

export function calcularImpuestoSellos(input: CalcularSellosInput): CalcularSellosResult {
  const precio = parseMontoSellos(input.precio, 'precio / valor de operación');
  const valuacionFiscal = parseMontoSellos(input.valuacionFiscal, 'valuación fiscal / base imponible');

  let alicuota = 3.6;
  if (input.alicuota !== undefined && input.alicuota !== null && input.alicuota !== '') {
    alicuota = parseMontoSellos(input.alicuota, 'alícuota');
  }

  let baseImponible: number;
  let baseUtilizada: BaseUtilizadaSellos;
  let explicacionBase: string;

  if (precio > valuacionFiscal) {
    baseImponible = precio;
    baseUtilizada = 'precio';
    explicacionBase = 'Se aplicó el precio de la operación por resultar superior a la valuación fiscal.';
  } else if (valuacionFiscal > precio) {
    baseImponible = valuacionFiscal;
    baseUtilizada = 'valuacion_fiscal';
    explicacionBase = 'Se aplicó la valuación fiscal por resultar superior al precio pactado.';
  } else {
    baseImponible = precio;
    baseUtilizada = 'iguales';
    explicacionBase = precio === 0
      ? 'Sin base imponible cargada.'
      : 'El precio y la valuación fiscal son equivalentes.';
  }

  const sellosTotal = Math.round(baseImponible * (alicuota / 100) * 100) / 100;
  const aCargoCadaParte = input.dividirPartes !== false ? Math.round((sellosTotal / 2) * 100) / 100 : sellosTotal;

  return {
    precio,
    valuacionFiscal,
    baseImponible,
    baseUtilizada,
    alicuotaPorcentaje: alicuota,
    sellosTotal,
    aCargoCadaParte,
    explicacionBase,
  };
}
