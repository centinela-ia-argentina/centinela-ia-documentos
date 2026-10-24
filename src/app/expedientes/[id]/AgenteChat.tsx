'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { preguntarAgente, ejecutarAccionAgente, diagnosticoLegajo, borrarConversacionAgente } from './agenteActions';
import type { MensajeChat, AccionPropuesta } from '@/lib/ai/agente';
import { Sparkle, PaperPlaneTilt, Trash, Check, X, ArrowCounterClockwise, ArrowSquareOut, Folder, Warning, ChatCircle } from '@phosphor-icons/react';
import styles from './ContextAgent.module.css';
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
        <strong key={`${keyPrefix}-${i}`} className={styles.strong}>
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
        <ul key={`ul-${key++}`} className={styles.list}>
          {items.map((item, i) => (
            <li key={i} className={styles.listItem}>
              <span className={styles.bullet} aria-hidden="true" />
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
        <p key={`p-${key++}`} className={styles.paragraph}>
          {renderInline(t, `p-${key}`)}
        </p>
      );
    }
  }
  flushLista();
  return <div className={styles.messageText}>{bloques}</div>;
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
  const titulo = `Agente IA ${terms.delExpediente}`;
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
    <div className={styles.agent}>
      <header className={styles.header}>
        <div className={styles.heading}><Sparkle size={22} aria-hidden="true" /><div>
          <p className={styles.eyebrow}>ASISTENCIA CONTEXTUAL · IA</p><h3>{titulo}</h3>
        </div></div>
        <div className={styles.badges}>
          <span><Folder size={16} aria-hidden="true" /> Contexto: {caseTitle || terms.itemSinTitulo}</span>
          {memoriaEstado === 'saved' && <span>💾 Memoria guardada</span>}
          {memoriaEstado === 'error' && <span className={styles.warning}>⚠️ No se pudo guardar la conversación</span>}
          <span>En línea</span>
        </div>
        <p className={styles.scope}>Trabaja con los documentos y antecedentes de {terms.eseExpediente || (industry === 'inmobiliaria' ? 'esa operación' : industry === 'escribania' ? 'ese legajo' : 'ese expediente')}. Puede proponer acciones que solo se ejecutan con tu aprobación.</p>
        {mensajes.length > 0 && <button type="button" onClick={borrarConversacion} className={styles.clear} title={`Borrar la conversación de ${terms.elExpediente}`}><Trash size={16} aria-hidden="true" /> Borrar conversación</button>}
      </header>
      <div ref={scrollRef} className={styles.conversation} role="region" aria-label="Conversación del agente" aria-busy={cargando}>
        {saludo && <div className={styles.greeting}>
          <MaquinaEscribir texto={[
            '👋 ¡Hola! ¿Cómo estás? ¿Qué tal tu día?', '',
            'Soy tu agente y estoy acá para ayudarte. La IA propone, vos decidís.', '',
            saludo.alertas.length > 0 ? ['Le eché un ojo mientras entrabas y noté esto:', ...saludo.alertas.map((a) => `• ${a}`)].join('\n') : 'Está todo en orden por ahora ✅', '', '¿En qué te puedo ayudar?',
          ].join('\n')} velocidad={14} className={styles.greetingText} />
        </div>}
        {mensajes.length === 0 && <div className={styles.suggestions}><p>Probá preguntando:</p>
          {sugerencias.map((s, i) => <button key={i} type="button" onClick={() => enviar(s)}>{s}<ArrowSquareOut size={16} aria-hidden="true" /></button>)}
        </div>}
        {mensajes.map((m, i) => <div key={i} className={m.rol === 'user' ? styles.userRow : styles.modelRow}>
          {m.rol === 'user' ? <div className={styles.userMessage}><small>Vos</small>{m.texto}</div> : <div className={styles.modelMessage}>
            <small>Agente Anulus</small><MensajeTexto texto={m.texto} />
            {m.acciones && m.acciones.length > 0 && <div className={styles.actions}>
              <p className={styles.actionHeading}><Sparkle size={16} aria-hidden="true" /> La IA sugiere una acción</p>
              {m.acciones.map((accion, ai) => {
                const clave = `${i}-${ai}`;
                const estado = accEstados[clave] ?? 'idle';
                const meta = ACCION_META[accion.tipo] ?? ACCION_META.agendar_plazo;
                if (estado === 'descartado') return <div key={clave} className={styles.discarded}><X size={16} aria-hidden="true" /><s>{accion.titulo}</s><button type="button" onClick={() => setAccEstados((p) => ({ ...p, [clave]: 'idle' }))}>Deshacer</button></div>;
                if (accion.tipo === 'sugerir_modelo') return <div key={clave} className={styles.actionCard}>
                  <p className={styles.actionTitle}><ArrowSquareOut size={18} aria-hidden="true" />{accion.titulo}</p>
                  {accion.motivo && <p className={styles.reason}>{accion.motivo}</p>}
                  <div className={styles.actionButtons}><a href={modeloUrl ?? '/modelos'} target="_blank" rel="noopener noreferrer">Abrir modelo <ArrowSquareOut size={16} aria-hidden="true" /></a><button type="button" onClick={() => descartar(clave)}><X size={16} aria-hidden="true" /> Descartar</button></div>
                </div>;
                const hecho = estado === 'ok';
                return <div key={clave} className={`${styles.actionCard} ${hecho ? styles.completed : ''}`}>
                  <div className={styles.actionTitle}>{hecho ? <Check size={18} aria-hidden="true" /> : <Sparkle size={18} aria-hidden="true" />}{accion.fecha && <span className={styles.date}>{formatFecha(accion.fecha)}</span>}<strong>{accion.titulo}</strong></div>
                  {accion.motivo && <p className={styles.reason}>{accion.motivo}</p>}
                  {hecho ? <p className={styles.success} role="status"><Check size={16} aria-hidden="true" />{meta.hecho}</p> : <div className={styles.actionButtons}>
                    <button type="button" onClick={() => ejecutar(clave, accion)} disabled={estado === 'loading'}>{estado === 'error' ? <ArrowCounterClockwise size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{estado === 'loading' ? meta.verboLoading : estado === 'error' ? 'Reintentar' : meta.verbo}</button>
                    <button type="button" onClick={() => descartar(clave)} disabled={estado === 'loading'}><X size={16} aria-hidden="true" /> Descartar</button>
                  </div>}
                  {estado === 'error' && <p className={styles.error} role="alert">No se pudo completar. Probá de nuevo.</p>}
                </div>;
              })}
            </div>}
          </div>}
        </div>)}
        {cargando && <p className={styles.thinking} role="status"><ChatCircle size={18} aria-hidden="true" /> Pensando…</p>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {avisoMemoria && <div className={styles.memoryWarning} role="status"><Warning size={18} aria-hidden="true" /><span>{avisoMemoria}</span><button type="button" onClick={() => setAvisoMemoria(null)}>Cerrar</button></div>}
      <form onSubmit={(e) => { e.preventDefault(); enviar(input); }} className={styles.form}>
        <label><span className={styles.inputLabel}>Tu consulta</span>
          <span className={styles.composer}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input); }
            }} rows={1} placeholder={`Escribí tu consulta sobre ${terms.elExpediente}…`} />
          </span>
        </label>
        <button type="submit" disabled={cargando || !input.trim()} className={styles.send}>Enviar <PaperPlaneTilt size={16} aria-hidden="true" /></button>
        <p className={styles.keyboard}>Enter para enviar · Shift + Enter para nueva línea</p>
      </form>
    </div>
  );
}
