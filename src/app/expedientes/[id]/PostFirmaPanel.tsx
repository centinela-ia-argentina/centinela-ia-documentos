'use client';

import { useState } from 'react';
import { CalendarCheck, Check, Info, Warning } from '@phosphor-icons/react/dist/ssr';
import { guardarPlazoDetectado } from '@/app/agenda/actions';

type Estado = 'idle' | 'loading' | 'ok' | 'existing' | 'error';

const PROPIUESTAS = [
  { id: 'sellado', titulo: 'Sellado', hint: 'Pago / presentación del impuesto de sellos según jurisdicción.' },
  { id: 'inscripcion', titulo: 'Inscripción en el Registro', hint: 'Presentación del testimonio / documentación para inscripción de la transmisión.' },
] as const;

export function PostFirmaPanel({
  caseId,
  caseTitle,
  fechaBase,
}: {
  caseId: string;
  caseTitle: string;
  fechaBase: string | null;
}) {
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [fechas, setFechas] = useState<Record<string, string>>({ sellado: '', inscripcion: '' });
  const baseTitulo = caseTitle ? ` — ${caseTitle}` : '';

  async function agendar(id: string, titulo: string) {
    const fecha = fechas[id]?.trim();
    if (!fecha) return;
    setEstados((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await guardarPlazoDetectado({
        titulo: `${titulo}${baseTitulo}`,
        fecha,
        detalle: 'Sugerido por la plataforma al otorgar el legajo. Revisado por el escribano.',
        caseId,
      });
      setEstados((prev) => ({ ...prev, [id]: res.ok ? (res.existing ? 'existing' : 'ok') : 'error' }));
    } catch {
      setEstados((prev) => ({ ...prev, [id]: 'error' }));
    }
  }

  function feedback(id: string) {
    const e = estados[id] ?? 'idle';
    if (e === 'ok') return <span className="flex items-center gap-1 text-[#1f7a4d]"><Check size={14} aria-hidden />Cargado en la Agenda.</span>;
    if (e === 'existing') return <span className="flex items-center gap-1 text-[#62676d]"><Check size={14} aria-hidden />Ya estaba en la Agenda.</span>;
    if (e === 'error') return <span className="flex items-center gap-1 text-[#a63d33]"><Warning size={14} aria-hidden />No se pudo agendar. Intentá de nuevo.</span>;
    return null;
  }

  return (
    <section
      data-testid="postfirma-panel"
      className="rounded-2xl border border-[#e4e5e3] bg-white p-4 shadow-sm"
      aria-labelledby="postfirma-title"
    >
      <h2 id="postfirma-title" className="flex items-center gap-2 text-base font-semibold text-[#25272a]">
        <CalendarCheck size={18} aria-hidden /> Legajo otorgado — plazos post-firma sugeridos
      </h2>
      <p className="mt-1 text-sm text-[#62676d]">
        Definí vos las fechas y agendá lo que corresponda. Nada se carga sin tu confirmación.
      </p>
      <div className="mt-3 space-y-3">
        {PROPIUESTAS.map((p) => (
          <div key={p.id} className="rounded-xl border border-[#d9d9d6] bg-white p-3">
            <p className="text-sm font-semibold text-[#25272a]">{p.titulo}</p>
            <p className="text-xs text-[#62676d]">{p.hint}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`postfirma-fecha-${p.id}`}>Fecha de {p.titulo}</label>
              <input
                id={`postfirma-fecha-${p.id}`}
                type="date"
                value={fechas[p.id] ?? ''}
                onChange={(e) => setFechas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="rounded-lg border border-[#d9d9d6] px-2 py-1.5 text-sm text-[#25272a] focus:border-[#415a71] focus:outline-none focus:ring-2 focus:ring-[#415a71]/25"
              />
              <button
                type="button"
                disabled={!fechas[p.id] || estados[p.id] === 'loading'}
                onClick={() => agendar(p.id, p.titulo)}
                data-testid={`postfirma-agendar-${p.id}`}
                className="rounded-lg bg-[#25272a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#393c42] disabled:opacity-40"
              >
                {estados[p.id] === 'loading' ? 'Agendando…' : 'Agendar en la Agenda'}
              </button>
              {feedback(p.id)}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>Sugerencia operativa, no un plazo legal calculado. {fechaBase ? `Fecha de otorgamiento registrada: ${fechaBase}.` : 'El legajo no tiene fecha de otorgamiento cargada.'} Ajustá según tu jurisdicción.</span>
      </p>
      <div className="mt-2">
        <a href={`/expedientes/${caseId}`} className="text-sm text-[#415a71] underline-offset-2 hover:underline">Cerrar sin agendar</a>
      </div>
    </section>
  );
}
