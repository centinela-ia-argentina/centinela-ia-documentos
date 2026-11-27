'use client';

import { useFormStatus } from 'react-dom';
import { ArrowsLeftRight, FileText, Info, Warning } from '@phosphor-icons/react/dist/ssr';
import type { ComparacionInstrumentos } from '@/lib/ai/comparador';
import { compararDocumentosExpediente } from '../actions';
import { AiDisclaimer } from '@/lib/industries/disclaimers';

type DocOption = { id: string; file_name: string };

const FEEDBACK: Record<string, { tono: 'ok' | 'error'; texto: string }> = {
  ok: { tono: 'ok', texto: 'Comparación generada. Revisá el reporte antes de usarlo.' },
  datos_faltantes: { tono: 'error', texto: 'Elegí dos documentos distintos para comparar.' },
  documento_no_encontrado: { tono: 'error', texto: 'Alguno de los documentos no está disponible en este legajo.' },
  sin_texto: { tono: 'error', texto: 'Alguno de los documentos no tiene texto extraíble (PDF escaneado o formato no soportado). Analizá esa versión o elegí otro archivo.' },
  comparacion_sin_key: { tono: 'error', texto: 'La comparación no está disponible ahora (sin API de IA). Intentá más tarde.' },
  comparacion_sin_texto: { tono: 'error', texto: 'No se pudo leer el texto de los documentos.' },
  comparacion_error: { tono: 'error', texto: 'La comparación falló. Intentá de nuevo.' },
  rubro_no_habilitado: { tono: 'error', texto: 'La comparación de instrumentos no está habilitada para este rubro.' },
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="comparador-submit"
      style={{ color: '#25272a', WebkitTextFillColor: '#25272a' }}
      className="inline-flex items-center gap-2 rounded-lg border border-[#d9d9d6] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f1f1ef] disabled:opacity-50"
    >
      {pending ? (
        <>
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" /><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" /></svg>
          Comparando…
        </>
      ) : (
        <><ArrowsLeftRight size={16} aria-hidden /> Comparar instrumentos</>
      )}
    </button>
  );
}

export function ComparadorInstrumentos({
  caseId,
  documents,
  comparacion,
  generadoEl,
  puedeUsarIA,
  feedback,
}: {
  caseId: string;
  documents: DocOption[];
  comparacion: ComparacionInstrumentos | null;
  generadoEl: string | null;
  puedeUsarIA: boolean;
  feedback?: string;
}) {
  const fb = feedback ? FEEDBACK[feedback] : undefined;

  return (
    <section
      data-testid="comparador-instrumentos"
      className="rounded-2xl border border-[#e4e5e3] bg-white p-4 shadow-sm"
      aria-labelledby="comparador-title"
    >
      <h2 id="comparador-title" className="flex items-center gap-2 text-base font-semibold text-[#25272a]">
        <ArrowsLeftRight size={18} aria-hidden /> Comparador de instrumentos (IA)
      </h2>
      <p className="mt-1 text-sm text-[#62676d]">
        Cotejás dos versiones del mismo instrumento (por ejemplo, la minuta aprobada y la protocolizada) y la IA marca las diferencias. El reporte es orientativo: la decisión final es tuya.
      </p>

      {fb && (
        <p role="status" aria-live="polite" data-testid="comparador-feedback" className={`mt-2 rounded-lg border p-2.5 text-sm ${fb.tono === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-[#a63d33]'}`}>
          {fb.texto}
        </p>
      )}

      {puedeUsarIA ? (
        documents.length >= 2 ? (
          <form action={compararDocumentosExpediente} className="mt-3 space-y-3">
            <input type="hidden" name="case_id" value={caseId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="comparador-doc-a" className="block text-xs font-medium text-[#62676d]">Instrumento A</label>
                <select id="comparador-doc-a" name="document_a" required data-testid="comparador-doc-a" defaultValue="" className="mt-1 w-full rounded-lg border border-[#d9d9d6] bg-white px-2 py-2 text-sm text-[#25272a] focus:border-[#415a71] focus:outline-none focus:ring-2 focus:ring-[#415a71]/25">
                  <option value="">— Elegí un documento —</option>
                  {documents.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="comparador-doc-b" className="block text-xs font-medium text-[#62676d]">Instrumento B</label>
                <select id="comparador-doc-b" name="document_b" required data-testid="comparador-doc-b" defaultValue="" className="mt-1 w-full rounded-lg border border-[#d9d9d6] bg-white px-2 py-2 text-sm text-[#25272a] focus:border-[#415a71] focus:outline-none focus:ring-2 focus:ring-[#415a71]/25">
                  <option value="">— Elegí un documento —</option>
                  {documents.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Submit />
              <p className="flex items-center gap-1.5 text-xs text-[#62676d]"><Info size={14} aria-hidden />Esto puede tardar hasta un minuto.</p>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[#62676d]"><FileText size={14} aria-hidden className="inline" /> Cargá al menos dos documentos en el legajo para poder compararlos.</p>
        )
      ) : (
        <p className="mt-3 text-sm text-[#62676d]">Tu rol no permite usar la IA.</p>
      )}

      {comparacion && (
        <div className="mt-4 space-y-3" data-testid="comparador-resultado">
          {generadoEl && <p className="text-xs text-[#8a8f94]">Comparación generada el {generadoEl.slice(0, 10).split('-').reverse().join('/')} · Lectura guardada · Revisar antes de usar.</p>}
          <p className="rounded-xl border border-[#e4e5e3] bg-[#fafaf9] p-3 text-sm text-[#25272a]">{comparacion.resumen}</p>

          {comparacion.diferencias.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#a63d33]">Diferencias ({comparacion.diferencias.length})</h3>
              <ul className="mt-1 space-y-2" data-testid="comparador-diferencias">
                {comparacion.diferencias.map((d, i) => (
                  <li key={i} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-sm font-semibold text-[#25272a]">{d.seccion}</p>
                    <p className="text-sm text-[#25272a]">{d.detalle}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparacion.coincidencias.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#25272a]">Coincidencias</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#25272a]" data-testid="comparador-coincidencias">
                {comparacion.coincidencias.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {comparacion.advertencias.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800"><Warning size={14} aria-hidden />Advertencias</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-800" data-testid="comparador-advertencias">
                {comparacion.advertencias.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <AiDisclaimer industry="escribania" className="text-xs text-[#8a8f94]" />
        </div>
      )}
    </section>
  );
}
