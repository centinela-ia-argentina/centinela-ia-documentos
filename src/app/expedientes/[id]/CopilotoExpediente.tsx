'use client';

import { useFormStatus } from 'react-dom';
import { generarResumenExpediente } from '../actions';

type ResumenExpediente = {
  resumen_general: string; estado_actual: string;
  partes: string[]; puntos_clave: string[]; riesgos_alertas: string[]; proximas_acciones: string[];
};

function BotonGenerar({ tieneResumen }: { tieneResumen: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
      {pending ? 'Generando…' : tieneResumen ? 'Actualizar resumen con IA' : 'Generar resumen con IA'}
    </button>
  );
}

function Bloque({ titulo, items, tono = 'slate' }: { titulo: string; items: string[]; tono?: 'slate' | 'amber' | 'emerald' }) {
  const tonos: Record<string, string> = {
    slate:   'border-white/10 bg-white/[0.04]',
    amber:   'border-amber-400/25 bg-amber-400/[0.06]',
    emerald: 'border-emerald-400/25 bg-emerald-400/[0.06]',
  };
  return (
    <div className={`rounded-xl border p-4 ${tonos[tono]}`}>
      <h3 className="mb-2 text-sm font-semibold text-white">{titulo}</h3>
      <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

export function CopilotoExpediente({
  caseId, resumen, generadoEl, documentosAnalizados, puedeUsarIA, terms,
}: {
  caseId: string; resumen: ResumenExpediente | null; generadoEl: string | null;
  documentosAnalizados: number; puedeUsarIA: boolean; terms: any;
}) {
  const generar = generarResumenExpediente.bind(null, caseId);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">🤖 {terms.copilotoTitulo}</h2>
          <p className="mt-1 text-sm text-slate-400">{terms.copilotoSubtitulo}</p>
        </div>
        {puedeUsarIA && (
          <form action={generar}><BotonGenerar tieneResumen={!!resumen} /></form>
        )}
      </div>

      {documentosAnalizados === 0 && !resumen && (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
          {terms.resumenVacio}
        </p>
      )}

      {!resumen && documentosAnalizados > 0 && (
        <p className="mt-4 text-sm text-slate-300">
          Hay {documentosAnalizados} documento(s) analizado(s). Tocá “Generar resumen con IA” para armar el panorama de este caso.
        </p>
      )}

      {resumen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-slate-200">{resumen.resumen_general}</p>
          {resumen.estado_actual && (
            <p className="text-sm text-slate-200"><span className="font-medium text-slate-400">Estado: </span>{resumen.estado_actual}</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {resumen.partes.length > 0 && <Bloque titulo={terms.partes} items={resumen.partes} />}
            {resumen.puntos_clave.length > 0 && <Bloque titulo="Puntos clave" items={resumen.puntos_clave} />}
            {resumen.riesgos_alertas.length > 0 && <Bloque titulo="⚠️ Riesgos y alertas" items={resumen.riesgos_alertas} tono="amber" />}
            {resumen.proximas_acciones.length > 0 && <Bloque titulo="Próximas acciones" items={resumen.proximas_acciones} tono="emerald" />}
          </div>
          {generadoEl && (
            <p className="text-xs text-slate-500">Generado el {new Date(generadoEl).toLocaleString('es-AR')} · Borrador orientativo, revisá antes de usar.</p>
          )}
        </div>
      )}
    </section>
  );
}
