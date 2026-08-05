'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Loader2 } from 'lucide-react';
import { guardarPlazoDetectado } from '@/app/agenda/actions';

type Plazo = { descripcion: string; fecha: string };

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function PlazosDetectados({
  plazos,
  docNombre,
}: {
  plazos: Plazo[];
  docNombre: string;
}) {
  const [estados, setEstados] = useState<
    Record<number, 'idle' | 'loading' | 'ok' | 'existing' | 'error'>
  >({});

  async function cargar(index: number, plazo: Plazo) {
    setEstados((prev) => ({ ...prev, [index]: 'loading' }));
    try {
      const res = await guardarPlazoDetectado({
        titulo: plazo.descripcion,
        fecha: plazo.fecha,
        detalle: `Detectado por IA en el documento: ${docNombre}`,
      });
      setEstados((prev) => ({ ...prev, [index]: res.ok ? (res.existing ? 'existing' : 'ok') : 'error' }));
    } catch {
      setEstados((prev) => ({ ...prev, [index]: 'error' }));
    }
  }

  if (!plazos?.length) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">
        📅 Plazos y fechas detectadas
      </h3>
      <ul className="space-y-2">
        {plazos.map((plazo, index) => {
          const estado = estados[index] ?? 'idle';
          return (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cyan-400">
                  {formatFecha(plazo.fecha)}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {plazo.descripcion}
                </p>
              </div>
              {estado === 'ok' ? (
                <span className="flex min-w-[132px] shrink-0 items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Cargado
                </span>
              ) : estado === 'existing' ? (
                <span className="flex min-w-[132px] shrink-0 items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400">
                  <Check className="h-3.5 w-3.5" />
                  Ya en agenda
                </span>
              ) : (
                <button
                  onClick={() => cargar(index, plazo)}
                  disabled={estado === 'loading'}
                  className="flex min-w-[132px] shrink-0 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {estado === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="h-3.5 w-3.5" />
                  )}
                  {estado === 'loading'
                    ? 'Cargando…'
                    : estado === 'error'
                    ? 'Reintentar'
                    : 'Cargar a agenda'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
