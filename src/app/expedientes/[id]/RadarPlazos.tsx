'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Loader2 } from 'lucide-react';
import { guardarPlazoDetectado } from '@/app/agenda/actions';
import { formatIsoToAr } from '@/lib/plazos/fechasCanonicas';
import {
  deduplicarPlazosRadar,
  NIVELES_RADAR,
  type PlazoRadar,
} from '@/lib/plazos/radarDeduplicacion';
import type { ItemCronologia } from './CronologiaExpediente';
import type { IndustryType } from '@/lib/industries/documentTypes';

function textoDias(n: number): string {
  if (n < 0) return `hace ${Math.abs(n)} día${Math.abs(n) === 1 ? '' : 's'}`;
  if (n === 0) return 'vence hoy';
  if (n === 1) return 'vence mañana';
  return `a ${n} días`;
}

function getDetalleAgenda(p: PlazoRadar, industry?: IndustryType): string {
  const etiquetaPrefijo =
    industry === 'inmobiliaria'
      ? 'Vencimiento de la operación'
      : industry === 'escribania'
        ? 'Vigencia del legajo'
        : 'Plazo del expediente';

  return `${etiquetaPrefijo} · ${p.item.etiquetaOrigen}`;
}

export function RadarPlazos({
  items,
  caseId,
  titulo = 'Radar de plazos',
  subtitulo = 'Plazos vencidos y próximos (hasta 30 días), ordenados por urgencia.',
  industry,
}: {
  items: ItemCronologia[];
  caseId: string;
  titulo?: string;
  subtitulo?: string;
  industry?: IndustryType;
}) {
  const [estados, setEstados] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'existing' | 'error'>>({});

  const plazos = deduplicarPlazosRadar(items);

  async function cargar(key: string, p: PlazoRadar) {
    setEstados((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const res = await guardarPlazoDetectado({
        titulo: p.item.titulo,
        fecha: p.item.fecha,
        detalle: getDetalleAgenda(p, industry),
        caseId,
      });
      setEstados((prev) => ({ ...prev, [key]: res?.ok ? (res.existing ? 'existing' : 'ok') : 'error' }));
    } catch {
      setEstados((prev) => ({ ...prev, [key]: 'error' }));
    }
  }

  if (plazos.length === 0) {
    return (
      <section data-testid="radar-plazos" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
        <h2 className="text-base font-semibold text-white">🚦 {titulo}</h2>
        <p className="mt-2 text-sm text-slate-300">
          No hay plazos vencidos ni próximos (30 días). Aparecerán aquí los plazos que detecte la IA o que cargues manualmente.
        </p>
      </section>
    );
  }

  const conteo = NIVELES_RADAR
    .map((nv) => ({ nivel: nv, n: plazos.filter((p) => p.nivel.id === nv.id).length }))
    .filter((c) => c.n > 0);

  return (
    <section data-testid="radar-plazos" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-white">🚦 {titulo}</h2>
        {conteo.map((c) => (
          <span key={c.nivel.id} className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.nivel.chip}`}>
            {c.nivel.icon} {c.n} {c.nivel.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-sm text-slate-300">
        {subtitulo}
      </p>

      <ul className="mt-4 space-y-2">
        {plazos.map((p, i) => {
          const key = `${p.item.fecha}-${i}`;
          const estado = estados[key] ?? 'idle';
          return (
            <li key={key} className={`flex items-center gap-3 rounded-xl border border-white/10 border-l-4 bg-white/[0.03] p-3 ${p.nivel.border}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.nivel.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.nivel.chip}`}>
                    {textoDias(p.dias)}
                  </span>
                  <span className="text-xs text-slate-400">{p.item.etiquetaOrigen}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-white">
                  {p.item.titulo.includes(formatIsoToAr(p.item.fecha))
                    ? p.item.titulo
                    : `${p.item.titulo} — ${formatIsoToAr(p.item.fecha)}`}
                </p>
              </div>
              {estado === 'ok' ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> En agenda
                </span>
              ) : estado === 'existing' ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                  <Check className="h-4 w-4" /> Ya en agenda
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => cargar(key, p)}
                  disabled={estado === 'loading'}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {estado === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  {estado === 'loading' ? 'Cargando…' : estado === 'error' ? 'Reintentar' : 'Cargar a agenda'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
