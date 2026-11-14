'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  preguntarADocumentos,
  buscarEntidadesOperativas,
  type FuenteBusqueda,
  type EntidadesOperativasResultado,
} from './actions';
import { AvisoPrivacidadIA } from '@/components/AvisoPrivacidadIA';
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import { MotionButton } from '@/components/ui/MotionButton';
import { MotionCard } from '@/components/ui/MotionCard';
import { IndustryType, getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { Sparkles, Search, FolderKanban, FileText } from 'lucide-react';

export function BuscarClient({ industry = null }: { industry?: IndustryType | null }) {
  const terms = industry ? getIndustryTerms(industry) : null;
  const entityPlural =
    industry === 'legal'
      ? 'Expedientes'
      : industry === 'escribania'
      ? 'Legajos'
      : industry === 'inmobiliaria'
      ? 'Operaciones'
      : 'Legajos / Expedientes';

  const [tab, setTab] = useState<'rag' | 'operativo'>('rag');

  // Estado para RAG
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<FuenteBusqueda[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estado para búsqueda operativa
  const [terminoOp, setTerminoOp] = useState('');
  const [buscandoOp, setBuscandoOp] = useState(false);
  const [resultadosOp, setResultadosOp] = useState<EntidadesOperativasResultado | null>(null);

  const placeholder =
    industry === 'legal'
      ? 'Ej: ¿Qué plazo procesal surge de la cédula de notificación?'
      : industry === 'escribania'
      ? 'Ej: ¿Qué antecedentes dominiales constan en la escritura?'
      : industry === 'inmobiliaria'
      ? 'Ej: ¿Qué plazo de vigencia tiene el contrato de locación?'
      : 'Ej: ¿Qué plazos, antecedentes o datos constan en los documentos?';

  async function onSubmitRag(e: React.FormEvent) {
    e.preventDefault();
    if (!pregunta.trim() || cargando) return;
    setCargando(true);
    setError(null);
    setRespuesta(null);
    setFuentes([]);
    try {
      const r = await preguntarADocumentos(pregunta);
      if (!r.ok) setError(r.error ?? 'Ocurrió un error.');
      else {
        setRespuesta(r.respuesta ?? '');
        setFuentes(r.fuentes ?? []);
      }
    } catch {
      setError('No se pudo completar la búsqueda.');
    } finally {
      setCargando(false);
    }
  }

  async function onBuscarOperativo(e: React.FormEvent) {
    e.preventDefault();
    if (!terminoOp.trim() || buscandoOp) return;
    setBuscandoOp(true);
    try {
      const res = await buscarEntidadesOperativas(terminoOp);
      setResultadosOp(res);
    } catch {
      setResultadosOp({ ok: false, legajos: [], documentos: [], error: 'Error al buscar entidades.' });
    } finally {
      setBuscandoOp(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('rag')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-bold transition-colors ${
            tab === 'rag'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Preguntá a tus documentos (RAG)
        </button>
        <button
          type="button"
          onClick={() => setTab('operativo')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-bold transition-colors ${
            tab === 'operativo'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
          }`}
        >
          <Search className="h-3.5 w-3.5" /> Buscador operativo
        </button>
      </div>

      {tab === 'rag' ? (
        <div>
          <form onSubmit={onSubmitRag} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[13.5px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
            />
            <MotionButton
              type="submit"
              disabled={cargando || !pregunta.trim()}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cargando ? 'Buscando…' : 'Preguntar'}
            </MotionButton>
          </form>

          <AvisoPrivacidadIA contexto="responder tu pregunta" />
          <AiDisclaimer industry={industry ?? undefined} className="mt-2" />

          {error && (
            <MotionCard index={1} className="mt-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </MotionCard>
          )}

          {respuesta && (
            <MotionCard index={2} className="mt-6 p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                Respuesta
              </h2>
              <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-900">
                {respuesta}
              </p>
            </MotionCard>
          )}

          {fuentes.length > 0 && (
            <MotionCard index={3} className="mt-4 p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                Fuentes citadas
              </h3>
              <ol className="mt-3 space-y-2">
                {fuentes.map((f, i) => (
                  <li key={i} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5 text-[13px] transition-colors hover:border-neutral-300">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-neutral-900">
                          [{i + 1}]
                        </span>
                        {f.caseTitle && (
                          <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                            {terms?.expedienteSingular ?? 'Operación'}: {f.caseTitle}
                          </span>
                        )}
                        <span className="font-semibold text-neutral-900">
                          Documento: {f.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 sm:mt-0">
                        {f.caseId && (
                          <Link
                            href={industry === 'inmobiliaria' ? `/operaciones/${f.caseId}` : `/expedientes/${f.caseId}`}
                            className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-neutral-900 hover:underline"
                          >
                            Ver {terms?.expedienteSingular?.toLowerCase() ?? 'operación'} →
                          </Link>
                        )}
                        <Link
                          href={`/documentos/${f.documentId}`}
                          className="shrink-0 text-xs font-bold text-neutral-900 hover:underline"
                        >
                          Ver documento →
                        </Link>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs text-neutral-500">{f.fragmento}</p>
                  </li>
                ))}
              </ol>
            </MotionCard>
          )}
        </div>
      ) : (
        <div>
          <form onSubmit={onBuscarOperativo} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={terminoOp}
              onChange={(e) => setTerminoOp(e.target.value)}
              placeholder={`Buscá por título, cliente, tipo o nombre de archivo…`}
              className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[13.5px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
            />
            <MotionButton
              type="submit"
              disabled={buscandoOp || !terminoOp.trim()}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscandoOp ? 'Buscando…' : 'Buscar'}
            </MotionButton>
          </form>

          {resultadosOp && (
            <div className="mt-6 space-y-6">
              {/* Legajos */}
              <div>
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-neutral-900">
                  <FolderKanban className="h-4 w-4 text-neutral-500" /> {entityPlural} ({resultadosOp.legajos.length})
                </h3>
                {resultadosOp.legajos.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-400">No se encontraron {entityPlural.toLowerCase()} con ese criterio.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {resultadosOp.legajos.map((l) => (
                      <Link
                        key={l.id}
                        href={`/expedientes/${l.id}`}
                        className="rounded-xl border border-neutral-200 bg-white p-3.5 transition-colors hover:border-neutral-400"
                      >
                        <p className="text-[13.5px] font-bold text-neutral-900">{l.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {l.client_name ? `Cliente: ${l.client_name}` : l.case_type || 'Sin tipo'}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos */}
              <div>
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-neutral-900">
                  <FileText className="h-4 w-4 text-neutral-500" /> Documentos ({resultadosOp.documentos.length})
                </h3>
                {resultadosOp.documentos.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-400">No se encontraron documentos con ese criterio.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {resultadosOp.documentos.map((d) => (
                      <Link
                        key={d.id}
                        href={`/documentos/${d.id}`}
                        className="rounded-xl border border-neutral-200 bg-white p-3.5 transition-colors hover:border-neutral-400"
                      >
                        <p className="truncate text-[13.5px] font-bold text-neutral-900">{d.file_name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {getDocumentTypeLabel(d.document_type)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
