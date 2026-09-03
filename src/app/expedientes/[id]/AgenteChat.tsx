'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { preguntarAgente, ejecutarAccionAgente, diagnosticoLegajo, borrarConversacionAgente } from './agenteActions';
import type { MensajeChat, AccionPropuesta } from '@/lib/ai/agente';
import { MaquinaEscribir } from '@/components/MaquinaEscribir';

type MensajeUI = MensajeChat & { acciones?: AccionPropuesta[] };

const ACCION_META: Record<
  AccionPropuesta['tipo'],
  { icono: string; verbo: string; verboLoading: string; hecho: string }
> = {
  agendar_plazo: { icono: '📅', verbo: 'Aprobar y agendar', verboLoading: 'Agendando…', hecho: 'Agendado en tu calendario' },
  crear_actuacion: { icono: '🗂️', verbo: 'Aprobar y registrar', verboLoading: 'Registrando…', hecho: 'Actuación registrada' },
  agregar_checklist: { icono: '✅', verbo: 'Aprobar y agregar', verboLoading: 'Agregando…', hecho: 'Agregado al checklist' },
  generar_resumen: { icono: '🧠', verbo: 'Aprobar y generar', verboLoading: 'Generando…', hecho: 'Resumen generado' },
  generar_cotejo: { icono: '⚖️', verbo: 'Aprobar y cotejar', verboLoading: 'Cotejando…', hecho: 'Cotejo generado' },
  redactar_borrador: { icono: '📝', verbo: 'Aprobar y redactar', verboLoading: 'Redactando…', hecho: 'Borrador generado' },
  analizar_uif: { icono: '🛡️', verbo: 'Aprobar y analizar', verboLoading: 'Analizando…', hecho: 'Análisis UIF generado' },
  cambiar_estado: { icono: '🔄', verbo: 'Aprobar y cambiar', verboLoading: 'Cambiando…', hecho: 'Estado actualizado' },
  vincular_documento: { icono: '🔗', verbo: 'Aprobar y vincular', verboLoading: 'Vinculando…', hecho: 'Documento vinculado' },
  agendar_turno: { icono: '📆', verbo: 'Aprobar y agendar turno', verboLoading: 'Agendando…', hecho: 'Turno agendado' },
  agendar_firma: { icono: '✍️', verbo: 'Aprobar y agendar firma', verboLoading: 'Agendando…', hecho: 'Firma agendada' },
  sugerir_modelo: { icono: '✒️', verbo: 'Abrir modelo', verboLoading: 'Abriendo…', hecho: 'Modelo abierto' },
  redactar_ros: { icono: '🚨', verbo: 'Aprobar y preparar ROS', verboLoading: 'Preparando…', hecho: 'ROS preparado' },
  calcular_liquidacion: { icono: "🧮", verbo: "Aprobar liquidación", verboLoading: "Calculando…", hecho: "Liquidación estimada" },
  calcular_plazo_procesal: { icono: '📅', verbo: 'Aprobar cálculo de plazo', verboLoading: 'Calculando…', hecho: 'Vencimiento calculado' },
  calcular_tasa_justicia: { icono: '🏛️', verbo: 'Aprobar cálculo de tasa', verboLoading: 'Calculando…', hecho: 'Tasa calculada' },
  redactar_aviso: { icono: '📢', verbo: 'Aprobar y redactar', verboLoading: 'Redactando…', hecho: 'Aviso generado' },
  calificar_inquilino: { icono: '✨', verbo: 'Aprobar y calificar', verboLoading: 'Calificando…', hecho: 'Pre-Score generado' },
};


function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-50">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{p}</span>;
  });
}

function MensajeTexto({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  const bloques: ReactNode[] = [];
  let lista: string[] = [];
  let key = 0;

  const flushLista = () => {
    if (lista.length) {
      const items = [...lista];
      bloques.push(
        <ul key={`ul-${key++}`} className="my-1 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
              <span>{renderInline(item, `li-${key}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
      lista = [];
    }
  };

  for (const linea of lineas) {
    const t = linea.trim();
    if (!t) {
      flushLista();
      continue;
    }
    const bullet = t.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      lista.push(bullet[1]);
    } else {
      flushLista();
      bloques.push(
        <p key={`p-${key++}`} className="my-1 leading-relaxed">
          {renderInline(t, `p-${key}`)}
        </p>
      );
    }
  }
  flushLista();
  return <div className="space-y-1">{bloques}</div>;
}


type Props = {
  caseId: string;
  caseTitle?: string;
  industry: string;
  puedeUsarIA: boolean;
  historialInicial?: MensajeUI[];
  modeloUrl?: string;
};

export function AgenteChat({ caseId, caseTitle, industry, puedeUsarIA, historialInicial, modeloUrl }: Props) {
  const terms = getIndustryTerms(industry as IndustryType);
  const titulo = `Agente IA del ${terms.expedienteSingular.toLowerCase()}`;
  const [mensajes, setMensajes] = useState<MensajeUI[]>(historialInicial ?? []);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [avisoMemoria, setAvisoMemoria] = useState<string | null>(null);
  const [memoriaEstado, setMemoriaEstado] = useState<'idle' | 'saved' | 'error'>(
    historialInicial && historialInicial.length > 0 ? 'saved' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [accEstados, setAccEstados] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error' | 'descartado'>>({});
  const [saludo, setSaludo] = useState<{ alertas: string[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!puedeUsarIA) return;
    let vivo = true;
    diagnosticoLegajo({ caseId })
      .then((r) => { if (vivo && r.ok) setSaludo({ alertas: r.alertas }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [caseId, puedeUsarIA]);

  const yaScrolleoInicial = useRef(false);
  useEffect(() => {
    if (!yaScrolleoInicial.current) {
      yaScrolleoInicial.current = true;
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, cargando]);

    const sugerencias = terms.agenteSugerenciasLocales;

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setError(null);
    const historialPrevio = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    setMensajes((prev) => [...prev, { rol: 'user', texto: pregunta }]);
    setInput('');
    setCargando(true);
    try {
      const res = await preguntarAgente({ caseId, historial: historialPrevio, pregunta });
      if (res.ok) {
        setMensajes((prev) => [...prev, { rol: 'model', texto: res.respuesta, acciones: res.acciones }]);
        if (res.memoryPersisted === false) {
          setMemoriaEstado('error');
          setAvisoMemoria('La respuesta se generó correctamente, pero no se pudo guardar la conversación en la memoria.');
        } else {
          setMemoriaEstado('saved');
          setAvisoMemoria(null);
        }
      } else {
        setError(res.motivo);
      }
    } catch {
      setError('Hubo un error de conexión. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function ejecutar(clave: string, accion: AccionPropuesta) {
    setAccEstados((p) => ({ ...p, [clave]: 'loading' }));
    try {
      const r = await ejecutarAccionAgente({ caseId, accion });
      setAccEstados((p) => ({ ...p, [clave]: r.ok ? 'ok' : 'error' }));
    } catch {
      setAccEstados((p) => ({ ...p, [clave]: 'error' }));
    }
  }

  function descartar(clave: string) {
    setAccEstados((p) => ({ ...p, [clave]: 'descartado' }));
  }

  async function borrarConversacion() {
    if (mensajes.length === 0 || cargando) return;
    if (!window.confirm('¿Borrar toda la conversación? No se puede deshacer.')) return;
    try {
      const r = await borrarConversacionAgente({ caseId });
      if (r.ok) {
        setMensajes([]);
        setError(null);
      } else {
        setError(r.motivo ?? 'No se pudo borrar la conversación.');
      }
    } catch {
      setError('Hubo un error de conexión. Probá de nuevo.');
    }
  }

  if (!puedeUsarIA) return null;

  return (
    <div className="agente-borde-vivo relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5">
      <style>{`
        @keyframes agenteShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes agenteBrilloBorde {
          0%, 100% { border-color: rgba(34,211,238,0.25); box-shadow: 0 0 18px rgba(34,211,238,0.06); }
          50% { border-color: rgba(34,211,238,0.55); box-shadow: 0 0 26px rgba(34,211,238,0.16); }
        }
        .agente-borde-vivo { animation: agenteBrilloBorde 3.2s ease-in-out infinite; }
        .agente-shimmer {
          background-image: linear-gradient(90deg, transparent, rgba(34,211,238,0.9), rgba(139,92,246,0.9), transparent);
          background-size: 200% 100%;
          animation: agenteShimmer 3s linear infinite;
        }
        @keyframes accionAparece {
          0% { opacity: 0; transform: translateY(6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes accionGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(139,92,246,0.35), 0 0 18px rgba(139,92,246,0.10); }
          50% { box-shadow: 0 0 0 1px rgba(34,211,238,0.45), 0 0 24px rgba(34,211,238,0.16); }
        }
        @keyframes accionPulso {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .accion-card { animation: accionAparece 0.35s ease-out both, accionGlow 3.4s ease-in-out infinite; }
        .accion-icono { animation: accionPulso 2.4s ease-in-out infinite; }
      `}</style>

      <span className="agente-shimmer pointer-events-none absolute inset-x-0 top-0 h-0.5" />

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-xl">
          🤖
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-50">{titulo}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-300 border border-cyan-500/20">
              📁 Contexto: {caseTitle || 'Este caso'}
            </span>
            {memoriaEstado === 'saved' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300 border border-violet-500/20">
                💾 Memoria guardada
              </span>
            )}
            {memoriaEstado === 'error' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/20">
                ⚠️ No se pudo guardar la conversación
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              En línea
            </span>
            {mensajes.length > 0 && (
              <button
                type="button"
                onClick={borrarConversacion}
                className="ml-auto rounded-lg border border-slate-700 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
                title="Borrar la conversación de este caso"
              >
                🗑️ Borrar conversación
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-300">
            Trabaja con los documentos y antecedentes de este caso. Puede proponer acciones que solo se ejecutan con tu aprobación.
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {saludo && (
          <div className="mb-4 rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.05] px-4 py-3 agente-borde-vivo">
            <MaquinaEscribir
              texto={[
                '👋 ¡Hola! ¿Cómo estás? ¿Qué tal tu día?',
                '',
                'Soy tu agente y estoy acá para ayudarte. La IA propone, vos decidís.',
                '',
                saludo.alertas.length > 0
                  ? ['Le eché un ojo mientras entrabas y noté esto:', ...saludo.alertas.map((a) => `• ${a}`)].join('\n')
                  : 'Está todo en orden por ahora ✅',
                '',
                '¿En qué te puedo ayudar?',
              ].join('\n')}
              velocidad={14}
              className="block whitespace-pre-line text-sm leading-relaxed text-slate-200"
            />
          </div>
        )}

        {mensajes.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Probá preguntando:</p>
            {sugerencias.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => enviar(s)}
                className="block w-full rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={m.rol === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.rol === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-500/20 px-3 py-2 text-sm text-cyan-50">
                {m.texto}
              </div>
            ) : (
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-slate-800/60 px-4 py-3 text-sm text-slate-200">
                <MensajeTexto texto={m.texto} />

                {m.acciones && m.acciones.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="agente-shimmer bg-clip-text text-xs font-semibold uppercase tracking-wide text-transparent">
                      💡 La IA sugiere una acción
                    </div>
                    {m.acciones.map((accion, ai) => {
                      const clave = `${i}-${ai}`;
                      const estado = accEstados[clave] ?? 'idle';
                      const meta = ACCION_META[accion.tipo] ?? ACCION_META.agendar_plazo;

                      if (estado === 'descartado') {
                        return (
                          <div key={clave} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
                            <span>🚫</span>
                            <span className="line-through">{accion.titulo}</span>
                            <button
                              onClick={() => setAccEstados((p) => ({ ...p, [clave]: 'idle' }))}
                              className="ml-auto underline-offset-2 hover:text-cyan-300 hover:underline"
                            >
                              Deshacer
                            </button>
                          </div>
                        );
                      }

                      if (accion.tipo === 'sugerir_modelo') {
                        return (
                          <div
                            key={clave}
                            className="accion-card rounded-xl border border-violet-500/25 bg-slate-900/60 p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="accion-icono text-lg leading-none">✒️</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-100">{accion.titulo}</p>
                                {accion.motivo && (
                                  <p className="mt-0.5 text-xs text-slate-400">{accion.motivo}</p>
                                )}
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <a
                                    href={modeloUrl ?? '/modelos'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-violet-400"
                                  >
                                    ✒️ Abrir modelo
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => descartar(clave)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300"
                                  >
                                    ✕ Descartar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const hecho = estado === 'ok';

                      return (
                        <div
                          key={clave}
                          className={`accion-card overflow-hidden rounded-xl border p-3 ${
                            hecho
                              ? 'border-emerald-500/40 bg-emerald-500/5'
                              : 'border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-slate-900/40 to-cyan-500/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`accion-icono flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${hecho ? 'bg-emerald-500/20' : 'bg-violet-500/20'}`}>
                              {hecho ? '✅' : meta.icono}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {accion.fecha && (
                                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${hecho ? 'bg-emerald-500/20 text-emerald-300' : 'bg-violet-500/20 text-violet-200'}`}>
                                    {formatFecha(accion.fecha)}
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-slate-100">{accion.titulo}</span>
                              </div>
                              {accion.motivo && (
                                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-400">{accion.motivo}</p>
                              )}

                              {hecho ? (
                                <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300">
                                  <span>✓</span> {meta.hecho}
                                </div>
                              ) : (
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => ejecutar(clave, accion)}
                                    disabled={estado === 'loading'}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-violet-400 disabled:opacity-60"
                                  >
                                    {estado === 'loading' ? `⏳ ${meta.verboLoading}` : estado === 'error' ? '↻ Reintentar' : `✅ ${meta.verbo}`}
                                  </button>
                                  <button
                                    onClick={() => descartar(clave)}
                                    disabled={estado === 'loading'}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-60"
                                  >
                                    ✕ Descartar
                                  </button>
                                </div>
                              )}
                              {estado === 'error' && (
                                <p className="mt-1.5 text-xs text-rose-400">No se pudo completar. Probá de nuevo.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {cargando && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              Pensando…
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {avisoMemoria && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span>⚠️ {avisoMemoria}</span>
          <button
            type="button"
            onClick={() => setAvisoMemoria(null)}
            className="ml-2 font-medium text-amber-400 underline hover:text-amber-200"
          >
            Cerrar
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(input);
            }
          }}
          rows={1}
          placeholder={`Escribí tu consulta sobre el ${terms.expedienteSingular.toLowerCase()}…`}
          className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={cargando || !input.trim()}
          className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
