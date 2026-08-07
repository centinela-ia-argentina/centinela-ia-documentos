export function periodoDeFecha(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // Extrae YYYY-MM
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export type ResultadoAjuste = {
  ok: boolean;
  montoSugerido?: number;
  coeficiente?: number;
  periodoBase?: string;
  periodoObjetivo?: string;
  motivo?: string;
};

export function calcularAjuste(params: {
  indexType: string | null;
  fixedPct: number | null;
  montoActual: number | null;
  periodoBase: string;
  periodoObjetivo: string;
  valorBase?: number | null;
  valorObjetivo?: number | null;
}): ResultadoAjuste {
  const { indexType, fixedPct, montoActual, periodoBase, periodoObjetivo, valorBase, valorObjetivo } = params;

  if (!montoActual || !Number.isFinite(montoActual) || montoActual <= 0) {
    return { ok: false, motivo: 'El monto actual del contrato es inválido.' };
  }

  if (indexType === 'FIJO') {
    const pct = fixedPct || 0;
    if (!Number.isFinite(pct)) {
      return { ok: false, motivo: 'El porcentaje fijo es inválido.' };
    }
    const coeficiente = 1 + pct / 100;
    if (coeficiente <= 0) {
      return { ok: false, motivo: 'El porcentaje fijo produce un coeficiente menor o igual a cero.' };
    }
    const montoSugerido = Number((montoActual * coeficiente).toFixed(2));
    return { ok: true, montoSugerido, coeficiente, periodoBase, periodoObjetivo };
  }

  if (indexType === 'ICL' || indexType === 'IPC' || indexType === 'CASA_PROPIA') {
    if (valorBase == null || !Number.isFinite(valorBase) || valorBase <= 0) {
      return { ok: false, motivo: `El índice base de ${periodoBase} es inválido o menor/igual a cero.` };
    }
    if (valorObjetivo == null || !Number.isFinite(valorObjetivo) || valorObjetivo <= 0) {
      return { ok: false, motivo: `El índice objetivo de ${periodoObjetivo} es inválido o menor/igual a cero.` };
    }

    const coeficiente = valorObjetivo / valorBase;
    if (!Number.isFinite(coeficiente) || coeficiente <= 0) {
      return { ok: false, motivo: 'El coeficiente calculado es inválido.' };
    }

    const montoSugerido = Number((montoActual * coeficiente).toFixed(2));
    if (!Number.isFinite(montoSugerido) || montoSugerido <= 0) {
      return { ok: false, motivo: 'El monto sugerido calculado es inválido.' };
    }

    return { ok: true, montoSugerido, coeficiente, periodoBase, periodoObjetivo };
  }

  return { ok: false, motivo: 'Índice de ajuste desconocido o no configurado.' };
}
