'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, Sparkles, AlertTriangle, ListChecks, Lightbulb, CheckCircle2, XCircle, FileWarning, Pencil } from 'lucide-react';
import { revisarEscritoIA, type RevisionEscrito } from './actions';

const SEMAFORO: Record<string, { label: string; chip: string; bar: string }> = {
  verde: { label: 'Listo para revisar y presentar', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  amarillo: { label: 'Necesita ajustes', chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  rojo: { label: 'Requiere trabajo importante', chip: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
};

function Bloque({ icon, titulo, items, tono }: { icon: ReactNode; titulo: string; items: string[]; tono: string }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl border border-[#e0e1e1] bg-[#f1f2f1] p-3">
      <div className={`flex items-center gap-2 text-sm font-semibold ${tono}`}>{icon} {titulo}</div>
      <ul className="mt-2 space-y-1 text-sm text-[#25272a]">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2"><span className="text-[#8a8f94]">•</span><span>{t}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function RevisarEscrito({ industria = 'legal' }: { industria?: string }) {
  const esEscribania = industria === 'escribania';
  const esInmobiliaria = industria === 'inmobiliaria';
  const tituloRevision = esEscribania
    ? 'Revisión de instrumentos con IA'
    : esInmobiliaria
    ? 'Revisión de documentos con IA'
    : 'Revisión de escritos con IA';
  const subtituloRevision = esEscribania
    ? 'Pegá un instrumento (escritura, poder, acta, certificación, minuta…) y la IA lo audita: qué le falta, errores, datos sin completar y sugerencias. Borrador orientativo, revisá siempre antes de otorgar.'
    : esInmobiliaria
    ? 'Pegá un documento (reserva, autorización de venta, boleto de compraventa, contrato…) y la IA lo audita: qué le falta, errores, datos sin completar y sugerencias. Borrador orientativo, revisá siempre antes de firmar.'
    : 'Pegá un escrito (demanda, contestación, recurso, carta…) y la IA lo audita: qué le falta, errores, datos sin completar y sugerencias. Borrador orientativo, revisá siempre antes de presentar.';
  const placeholderRevision = esInmobiliaria
    ? 'Pegá acá el texto del documento a revisar…'
    : esEscribania
    ? 'Pegá acá el texto del instrumento a revisar…'
    : 'Pegá acá el texto del escrito a revisar…';

  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<'idle' | 'loading' | 'error' | 'sin_key' | 'sin_texto'>('idle');
  const [rev, setRev] = useState<RevisionEscrito | null>(null);

  async function revisar() {
    setEstado('loading');
    setRev(null);
    try {
      const res = await revisarEscritoIA({ texto });
      if (res.ok) {
        setRev(res.revision);
        setEstado('idle');
      } else {
        setEstado(res.motivo === 'sin_key' ? 'sin_key' : res.motivo === 'sin_texto' ? 'sin_texto' : 'error');
      }
    } catch {
      setEstado('error');
    }
  }

  const sem = rev ? (SEMAFORO[rev.semaforo] ?? SEMAFORO.amarillo) : null;

  return (
    <section className="rounded-2xl border border-[#d9d9d6] bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[#25272a]"><Pencil className="h-4 w-4" /> {tituloRevision}</h2>
      <p className="mt-1 text-sm text-[#62676d]">
        {subtituloRevision}
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={10}
        placeholder={placeholderRevision}
        className="mt-3 w-full rounded-xl border border-[#d9d9d6] p-3 text-sm text-[#25272a] focus:border-[#415a71] focus:outline-none focus:ring-2 focus:ring-[#415a71]/25"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={revisar}
          disabled={estado === 'loading' || texto.trim().length < 40}
          className="flex items-center gap-2 rounded-lg bg-[#25272a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#393c42] disabled:cursor-not-allowed disabled:border disabled:border-[#d9d9d6] disabled:bg-white disabled:text-[#8a8f94]"
        >
          {estado === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {estado === 'loading' ? 'Revisando…' : 'Revisar con IA'}
        </button>
        <span className="text-xs text-[#8a8f94]">{texto.trim().length} caracteres · mínimo 40 para revisar</span>
      </div>

      {estado === 'sin_texto' && <p className="mt-3 text-sm text-amber-600">Pegá un texto más largo para poder revisarlo.</p>}
      {estado === 'sin_key' && <p className="mt-3 text-sm text-amber-600">La IA no está activada (falta la clave de Gemini).</p>}
      {estado === 'error' && <p className="mt-3 text-sm text-red-600">No se pudo revisar. Probá de nuevo en unos segundos.</p>}

      {rev && sem && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-[#e0e1e1] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sem.chip}`}>{sem.label}</span>
              <span className="text-sm font-semibold text-[#25272a]">{rev.puntuacion}/100</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ececea]">
              <div className={`h-full ${sem.bar}`} style={{ width: `${rev.puntuacion}%` }} />
            </div>
            {rev.resumen && <p className="mt-2 text-sm text-[#62676d]">{rev.resumen}</p>}
          </div>

          <Bloque icon={<FileWarning className="h-4 w-4" />} titulo="Secciones faltantes o flojas" items={rev.secciones_faltantes} tono="text-amber-700" />
          <Bloque icon={<AlertTriangle className="h-4 w-4" />} titulo="Errores e inconsistencias" items={rev.errores} tono="text-red-700" />
          <Bloque icon={<FileWarning className="h-4 w-4" />} titulo="Datos sin completar" items={rev.datos_incompletos} tono="text-[#25272a]" />
          <Bloque icon={<Lightbulb className="h-4 w-4" />} titulo="Sugerencias de mejora" items={rev.sugerencias} tono="text-[#25272a]" />

          {rev.checklist.length > 0 && (
            <div className="rounded-xl border border-[#e0e1e1] bg-[#f1f2f1] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#25272a]">
                <ListChecks className="h-4 w-4" /> Checklist de presentación
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {rev.checklist.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-[#8a8f94]" />}
                    <span className={c.ok ? 'text-[#25272a]' : 'text-[#62676d]'}>{c.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
