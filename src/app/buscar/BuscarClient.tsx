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
      <div className="mb-6 flex gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setTab('rag')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'rag'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Sparkles className="h-4 w-4" /> Preguntá a tus documentos (RAG)
        </button>
        <button
          type="button"
          onClick={() => setTab('operativo')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'operativo'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Search className="h-4 w-4" /> Buscador operativo
        </button>
      </div>

      {tab === 'rag' ? (
        <div>
          <AvisoPrivacidadIA contexto="responder tu pregunta" />
          <AiDisclaimer industry={industry ?? undefined} className="mb-4" />
          <form onSubmit={onSubmitRag} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white shadow-sm outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
            <MotionButton
              type="submit"
              disabled={cargando || !pregunta.trim()}
              className="rounded-xl bg-gradient-to-r from-accent to-brandviolet px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cargando ? 'Buscando…' : 'Preguntar'}
            </MotionButton>
          </form>

          {error && (
            <MotionCard index={1} className="mt-4 border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </MotionCard>
          )}

          {respuesta && (
            <MotionCard index={2} className="mt-6 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Respuesta
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white">
                {respuesta}
              </p>
            </MotionCard>
          )}

          {fuentes.length > 0 && (
            <MotionCard index={3} className="mt-4 p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fuentes
              </h3>
              <ol className="space-y-2">
                {fuentes.map((f, i) => (
                  <li key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm transition hover:bg-white/[0.04]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-cyan-300">
                          [{i + 1}]
                        </span>
                        {f.caseTitle && (
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300">
                            {terms?.expedienteSingular ?? 'Operación'}: {f.caseTitle}
                          </span>
                        )}
                        <span className="font-medium text-slate-200">
                          Documento: {f.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 sm:mt-0">
                        {f.caseId && (
                          <Link
                            href={industry === 'inmobiliaria' ? `/operaciones/${f.caseId}` : `/expedientes/${f.caseId}`}
                            className="shrink-0 text-xs font-semibold text-slate-400 hover:text-white hover:underline"
                          >
                            Ver {terms?.expedienteSingular?.toLowerCase() ?? 'operación'} →
                          </Link>
                        )}
                        <Link
                          href={`/documentos/${f.documentId}`}
                          className="shrink-0 text-xs font-semibold text-cyan-400 hover:underline"
                        >
                          Ver documento →
                        </Link>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs text-slate-400">{f.fragmento}</p>
                  </li>
                ))}
              </ol>
            </MotionCard>
          )}
        </div>
      ) : (
        <div>
          <form onSubmit={onBuscarOperativo} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={terminoOp}
              onChange={(e) => setTerminoOp(e.target.value)}
              placeholder={`Buscá por título, cliente, tipo o nombre de archivo…`}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white shadow-sm outline-none placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
            <MotionButton
              type="submit"
              disabled={buscandoOp || !terminoOp.trim()}
              className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscandoOp ? 'Buscando…' : 'Buscar'}
            </MotionButton>
          </form>

          {resultadosOp && (
            <div className="mt-6 space-y-6">
              {/* Legajos */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FolderKanban className="h-4 w-4 text-cyan-400" /> {entityPlural} ({resultadosOp.legajos.length})
                </h3>
                {resultadosOp.legajos.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No se encontraron {entityPlural.toLowerCase()} con ese criterio.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {resultadosOp.legajos.map((l) => (
                      <Link
                        key={l.id}
                        href={`/expedientes/${l.id}`}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
                      >
                        <p className="font-semibold text-sm text-white">{l.title}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {l.client_name ? `Cliente: ${l.client_name}` : l.case_type || 'Sin tipo'}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4 text-cyan-400" /> Documentos ({resultadosOp.documentos.length})
                </h3>
                {resultadosOp.documentos.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No se encontraron documentos con ese criterio.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {resultadosOp.documentos.map((d) => (
                      <Link
                        key={d.id}
                        href={`/documentos/${d.id}`}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
                      >
                        <p className="font-semibold text-sm text-white truncate">{d.file_name}</p>
                        <p className="text-xs text-slate-400 mt-1">
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
