import type { ItemCronologia } from '@/app/expedientes/[id]/CronologiaExpediente';

export type NivelPlazo = {
  id: string;
  label: string;
  test: (n: number) => boolean;
  dot: string;
  chip: string;
  icon: string;
  border: string;
};

export const PISO_VENCIDO_DIAS = 90;

export const NIVELES_RADAR: NivelPlazo[] = [
  { id: 'vencido', label: 'Vencido', test: (n) => n < 0 && n >= -PISO_VENCIDO_DIAS, dot: 'bg-rose-500', chip: 'bg-rose-500/20 text-rose-300', icon: '🔴', border: 'border-l-rose-500' },
  { id: 'urgente', label: '≤ 7 días', test: (n) => n >= 0 && n <= 7, dot: 'bg-orange-500', chip: 'bg-orange-500/20 text-orange-300', icon: '🟠', border: 'border-l-orange-500' },
  { id: 'proximo', label: '≤ 15 días', test: (n) => n > 7 && n <= 15, dot: 'bg-amber-400', chip: 'bg-amber-500/20 text-amber-300', icon: '🟡', border: 'border-l-amber-400' },
  { id: 'agenda', label: '≤ 30 días', test: (n) => n > 15 && n <= 30, dot: 'bg-emerald-500', chip: 'bg-emerald-500/20 text-emerald-300', icon: '🟢', border: 'border-l-emerald-500' },
];

export function nivelDe(n: number): NivelPlazo | null {
  return NIVELES_RADAR.find((x) => x.test(n)) ?? null;
}

export function diasDesdeHoy(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(y, m - 1, d);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
}

export type PlazoRadar = {
  item: ItemCronologia;
  dias: number;
  nivel: NivelPlazo;
};

export function esPlazoRadarTexto(texto: string): boolean {
  const t = texto.toLowerCase();
  return (
    t.includes('plazo') ||
    t.includes('vencimiento') ||
    t.includes('audiencia') ||
    t.includes('perentorio') ||
    t.includes('caducidad') ||
    t.includes('prescripción') ||
    t.includes('prescripcion') ||
    t.includes('término') ||
    t.includes('termino') ||
    t.includes('intimación') ||
    t.includes('intimacion') ||
    t.includes('vigencia') ||
    t.includes('reserva') ||
    t.includes('oferta') ||
    t.includes('posesión') ||
    t.includes('posesion') ||
    t.includes('visita') ||
    t.includes('entrega') ||
    t.includes('clave') ||
    t.includes('relevante') ||
    t.includes('límite') ||
    t.includes('limite') ||
    t.includes('escrituración') ||
    t.includes('escrituracion')
  );
}

export function esFechaExcluida(texto: string): boolean {
  const t = texto.toLowerCase();
  return (
    t.includes('emisión') ||
    t.includes('emision') ||
    t.includes('fecha del boleto') ||
    t.includes('fecha de boleto') ||
    t.includes('comprobante de pago') ||
    t.includes('recibo de sueldo')
  );
}

export function clasificarPlazoSemantico(titulo: string, detalle?: string | null): {
  categoria: string;
  esGenerico: boolean;
  claveSemantica: string;
} {
  const text = `${titulo} ${detalle || ''}`.toLowerCase();

  let categoria = 'otro';
  if (text.includes('oferta') || text.includes('reserva')) {
    categoria = 'oferta_reserva';
  } else if (text.includes('visita')) {
    categoria = 'visita';
  } else if (text.includes('audiencia')) {
    categoria = 'audiencia';
  } else if (text.includes('posesion') || text.includes('posesión') || text.includes('entrega')) {
    categoria = 'posesion_entrega';
  } else if (text.includes('escritura') || text.includes('escrituracion') || text.includes('escrituración')) {
    categoria = 'escrituracion';
  } else if (text.includes('ajuste')) {
    categoria = 'ajuste_canon';
  } else if (text.includes('vencimiento') || text.includes('vigencia')) {
    categoria = 'vencimiento_general';
  }

  const esGenerico =
    text.includes('relevante') ||
    text.includes('clave') ||
    text.includes('detectada') ||
    text.includes('fecha próxima') ||
    text.includes('fecha proxima');

  const claveSemantica = esGenerico ? 'generico' : categoria !== 'otro' ? categoria : titulo.toLowerCase().replace(/[^a-z0-9]/g, '');

  return { categoria, esGenerico, claveSemantica };
}

/**
 * Deduplicación semántica conservadora para el Radar de Plazos.
 */
export function deduplicarPlazosRadar(
  items: ItemCronologia[],
  calcDias: (iso: string) => number = diasDesdeHoy,
  calcNivel: (dias: number) => NivelPlazo | null = nivelDe
): PlazoRadar[] {
  const plazosFiltrados: PlazoRadar[] = items
    .filter((it) => {
      if (it.origen === 'documento') return false;

      const textoCompleto = `${it.titulo} ${it.detalle || ''}`;
      if (esFechaExcluida(textoCompleto)) {
        return false;
      }

      return esPlazoRadarTexto(it.titulo) || (it.detalle ? esPlazoRadarTexto(it.detalle) : false);
    })
    .map((it) => {
      const dias = calcDias(it.fecha);
      const nivel = calcNivel(dias);
      return { item: it, dias, nivel: nivel as NivelPlazo };
    })
    .filter((p): p is PlazoRadar => !Number.isNaN(p.dias) && p.nivel !== null)
    .sort((a, b) => a.dias - b.dias);

  const plazosMap = new Map<string, PlazoRadar>();

  for (const p of plazosFiltrados) {
    const sem = clasificarPlazoSemantico(p.item.titulo, p.item.detalle);

    let merged = false;
    for (const [k, existente] of plazosMap.entries()) {
      if (existente.item.fecha !== p.item.fecha) continue;

      const semExistente = clasificarPlazoSemantico(existente.item.titulo, existente.item.detalle);

      // Fusión conservadora:
      // 1. Si uno es genérico y el otro específico -> fusionar.
      // 2. Si ambos son específicos, NO fusionar solo por compartir categoría: solo fusionar si representan
      //    el mismo hecho (mismo título normalizado sin puntuación/artículos).
      const t1 = existente.item.titulo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const t2 = p.item.titulo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const mismoTitulo = t1 === t2;

      const mismoHecho =
        (semExistente.esGenerico && !sem.esGenerico) ||
        (!semExistente.esGenerico && sem.esGenerico) ||
        (mismoTitulo);

      if (mismoHecho) {
        const tituloElegido = (semExistente.esGenerico && !sem.esGenerico) ? p.item.titulo : existente.item.titulo;
        const etiquetasCombinadas = Array.from(
          new Set([existente.item.etiquetaOrigen, p.item.etiquetaOrigen].filter(Boolean))
        ).join(' + ');

        plazosMap.set(k, {
          ...existente,
          item: {
            ...existente.item,
            titulo: tituloElegido,
            etiquetaOrigen: etiquetasCombinadas,
          },
        });
        merged = true;
        break;
      }
    }

    if (!merged) {
      const uniqueKey = `${p.item.fecha}_${sem.claveSemantica}_${p.item.titulo}_${p.item.etiquetaOrigen}`;
      plazosMap.set(uniqueKey, { ...p });
    }
  }

  return Array.from(plazosMap.values()).sort((a, b) => a.dias - b.dias);
}
