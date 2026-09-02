'use client';

import { useState, type FormEvent } from 'react';
import { FileSearch, Loader2, Send, Sparkles } from 'lucide-react';
import { preguntarADocumentosLegajo, type FuenteLegajo } from './ragLegajoActions';

function RespuestaConCitas({ texto }: { texto: string }) {
  const parrafos = texto.split('\n').filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-2">
      {parrafos.map((p, pi) => (
        <p key={pi} className="leading-relaxed">
          {p.split(/(\[\d+\])/g).map((parte, i) =>
            /^\[\d+\]$/.test(parte) ? (
              <sup
                key={i}
                className="mx-0.5 inline-flex items-center rounded bg-cyan-500/20 px-1 text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30"
              >
                {parte.replace(/[[\]]/g, '')}
              </sup>
            ) : (
              <span key={i}>{parte}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

export function PreguntarDocumentos({
  caseId,
  puedeUsarIA,
}: {
  caseId: string;
  puedeUsarIA: boolean;
}) {
  const [pregunta, setPregunta] = useState('');
  const [preguntaMostrada, setPreguntaMostrada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<FuenteLegajo[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!puedeUsarIA) return null;

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const q = pregunta.trim();
    if (!q || cargando) return;
    setPreguntaMostrada(q);
    setPregunta('');
    setCargando(true);
    setError(null);
    setRespuesta(null);
    setFuentes([]);
    try {
      const r = await preguntarADocumentosLegajo(caseId, q);
      if (r.ok) {
        setRespuesta(r.respuesta ?? '');
        setFuentes(r.fuentes ?? []);
      } else {
        setError(r.error ?? 'No se pudo responder.');
      }
    } catch {
      setError('Hubo un error de conexión. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/60 to-slate-900/30 p-4">
      <style>{`
        @keyframes ragAparece {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .rag-aparece { animation: ragAparece 0.4s ease-out both; }
        @keyframes ragPunto {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .rag-punto { animation: ragPunto 1.2s infinite ease-in-out; }
      `}</style>

      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-300">
          <FileSearch className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Preguntá a los documentos</h3>
          <p className="text-xs text-slate-400">
            Respuestas basadas en el contenido real de este legajo, con la fuente citada.
          </p>
        </div>
      </div>

      <form onSubmit={enviar} className="flex items-end gap-2">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ej: ¿Quién es el titular del inmueble? ¿Hay hipoteca?"
          data-testid="rag-input"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-500 focus:shadow-[0_0_14px_rgba(34,211,238,0.15)] focus:outline-none"
        />
        <button
          type="submit"
          data-testid="rag-submit"
          disabled={cargando || !pregunta.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-cyan-400 active:scale-95 disabled:opacity-60"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Preguntar
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      {(preguntaMostrada || cargando || respuesta) && (
        <div className="mt-4 space-y-3">
          {preguntaMostrada && (
            <div className="flex justify-end">
              <div className="rag-aparece max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-900/20">
                {preguntaMostrada}
              </div>
            </div>
          )}

          {cargando && (
            <div className="flex items-center gap-2 text-xs text-cyan-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Leyendo los documentos</span>
              <span className="flex gap-0.5">
                <span className="rag-punto h-1 w-1 rounded-full bg-cyan-300" style={{ animationDelay: '0s' }} />
                <span className="rag-punto h-1 w-1 rounded-full bg-cyan-300" style={{ animationDelay: '0.2s' }} />
                <span className="rag-punto h-1 w-1 rounded-full bg-cyan-300" style={{ animationDelay: '0.4s' }} />
              </span>
            </div>
          )}

          {respuesta && (
            <div className="rag-aparece flex gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-300 ring-1 ring-cyan-500/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-3">
                <div className="rounded-2xl rounded-tl-sm border border-cyan-500/20 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-lg shadow-cyan-950/20" data-testid="rag-response">
                  <RespuestaConCitas texto={respuesta} />
                </div>

                {fuentes.length > 0 && (
                  <div data-testid="rag-sources">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Fuentes
                    </p>
                    <div className="space-y-1.5">
                      {fuentes.map((f, i) => (
                        <details
                          key={`${f.documentId}-${i}`}
                          data-testid={`rag-source-${i}`}
                          className="group rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-500/30"
                        >
                          <summary className="flex cursor-pointer select-none items-center gap-2 font-medium text-cyan-300">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-cyan-500/20 text-[10px] font-semibold ring-1 ring-cyan-500/30">
                              {i + 1}
                            </span>
                            {f.fileName}
                          </summary>
                          <p className="mt-2 whitespace-pre-line text-slate-400">{f.fragmento}</p>
                        </details>
                      ))}
                    </div>
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
