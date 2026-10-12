'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Sparkle, ArrowRight, ChatCircle, TextAlignLeft, ShieldCheck, CircleNotch, WarningCircle, Compass, ListChecks, Lightbulb } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { SectionTitle } from '@/components/ui/Typography';
import { generarBriefing, preguntarCopiloto } from './actions';
import styles from './Copiloto.module.css';

type Briefing = { panorama: string; prioridades: string[]; alertas: string[]; oportunidades: string[] };
type Mensaje = { role: 'user' | 'ia'; text: string };
type View = 'summary' | 'chat';
const SUGERENCIAS = [
  '¿Qué propiedades tengo disponibles?',
  '¿Qué operaciones están en curso?',
  '¿Qué alquileres ajustan pronto?',
  '¿A qué cliente le sirve mi propiedad disponible?',
];

export function CopilotoClient({ canUsePortfolioAi }: { canUsePortfolioAi: boolean }) {
  const id = useId();
  const bodyId = `${id}-body`;
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<View>('summary');
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const mounted = useRef(true);
  const briefingPending = useRef(false);
  const questionPending = useRef(false);
  const summaryTab = useRef<HTMLButtonElement>(null);
  const chatTab = useRef<HTMLButtonElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View = event.key === 'Home' ? 'summary' : event.key === 'End' ? 'chat' : view === 'summary' ? 'chat' : 'summary';
    setView(next);
    (next === 'summary' ? summaryTab : chatTab).current?.focus();
  }

  async function handleGenerar() {
    if (!canUsePortfolioAi || briefingPending.current) return;
    briefingPending.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await generarBriefing();
      if (!mounted.current) return;
      if (res.ok) setBriefing(res.briefing);
      else setError(res.motivo === 'sin_api_key'
        ? 'La asistencia con IA no está configurada. Contactá al administrador.'
        : res.motivo === 'sin_datos'
        ? 'Todavía no hay datos suficientes. Cargá propiedades, operaciones o clientes.'
        : res.motivo === 'sin_permiso'
        ? 'Tu cuenta no tiene permiso para usar la asistencia con IA.'
        : res.motivo === 'sin_sesion'
        ? 'Tu sesión no está disponible. Volvé a ingresar.'
        : 'No se pudo generar el resumen. Probá de nuevo en un momento.');
    } catch {
      if (mounted.current) setError('No se pudo generar el resumen. Probá de nuevo en un momento.');
    } finally {
      briefingPending.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  async function handlePreguntar(texto: string) {
    const q = texto.trim();
    if (!canUsePortfolioAi || !q || questionPending.current) return;
    questionPending.current = true;
    setPregunta('');
    setChatError(null);
    setMensajes((prev) => [...prev, { role: 'user', text: q }]);
    setPensando(true);
    try {
      const res = await preguntarCopiloto(q);
      if (!mounted.current) return;
      if (res.ok) setMensajes((prev) => [...prev, { role: 'ia', text: res.respuesta }]);
      else setChatError(res.motivo === 'sin_api_key'
        ? 'La asistencia con IA no está configurada. Contactá al administrador.'
        : res.motivo === 'sin_pregunta'
        ? 'Escribí una pregunta.'
        : res.motivo === 'sin_permiso'
        ? 'Tu cuenta no tiene permiso para usar la asistencia con IA.'
        : res.motivo === 'sin_sesion'
        ? 'Tu sesión no está disponible. Volvé a ingresar.'
        : 'No pude responder ahora. Probá de nuevo en un momento.');
    } catch {
      if (mounted.current) setChatError('No pude responder ahora. Probá de nuevo en un momento.');
    } finally {
      questionPending.current = false;
      if (mounted.current) setPensando(false);
    }
  }

  if (!canUsePortfolioAi) {
    return <Surface as="section" family="callout" className={styles.readOnly} aria-labelledby={`${id}-readonly`}>
      <ShieldCheck size={23} aria-hidden="true" />
      <div><SectionTitle id={`${id}-readonly`}>Vista de consulta</SectionTitle><p>Podés revisar los indicadores y abrir los módulos autorizados. La asistencia con IA está disponible para administradores y empleados.</p></div>
    </Surface>;
  }

  return (
    <Surface as="section" className={styles.intelligence} aria-labelledby={`${id}-title`}>
      <header className={styles.intelligenceHeader}>
        <div><span className={styles.aiLabel}><Sparkle size={14} aria-hidden="true" />Asistente IA</span>
          <SectionTitle id={`${id}-title`}>Inteligencia de cartera</SectionTitle>
          <p>Consultá tu cartera y generá un resumen con inteligencia artificial.</p>
        </div>
        <AppButton aria-expanded={expanded} aria-controls={bodyId} className={styles.primaryAction} onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Cerrar asistente IA' : 'Abrir asistente IA'}<ArrowRight size={17} aria-hidden="true" />
        </AppButton>
      </header>
      <div id={bodyId} hidden={!expanded} className={styles.intelligenceBody}>
        <div role="tablist" aria-label="Vistas del asistente IA" className={styles.tabs}>
          <button ref={summaryTab} id={`${id}-summary-tab`} type="button" role="tab" aria-selected={view === 'summary'} aria-controls={`${id}-summary-panel`} tabIndex={view === 'summary' ? 0 : -1} onClick={() => setView('summary')} onKeyDown={onTabKey}>Resumen de cartera</button>
          <button ref={chatTab} id={`${id}-chat-tab`} type="button" role="tab" aria-selected={view === 'chat'} aria-controls={`${id}-chat-panel`} tabIndex={view === 'chat' ? 0 : -1} onClick={() => setView('chat')} onKeyDown={onTabKey}>Consultas de cartera</button>
        </div>
        <div id={`${id}-summary-panel`} role="tabpanel" aria-labelledby={`${id}-summary-tab`} hidden={view !== 'summary'} tabIndex={0} className={styles.pane}>
          <h3 className={styles.paneTitle}><TextAlignLeft size={23} aria-hidden="true" />Resumen de cartera</h3>
          <p className={styles.paneCopy}>Interpretá el conjunto de propiedades, operaciones, clientes y alquileres, sin perder de vista los registros.</p>
          <div className={styles.summaryActions}>
            <AppButton className={styles.primaryAction} onClick={handleGenerar} disabled={loading}>
              {loading ? <CircleNotch size={18} className={styles.spinner} aria-hidden="true" /> : <Sparkle size={18} aria-hidden="true" />}
              {loading ? 'Generando…' : briefing ? 'Regenerar resumen' : 'Generar resumen'}
            </AppButton><span>Solo cuando lo solicitás.</span>
          </div>
          {loading && <p role="status" className={styles.pending}>Generando resumen de cartera…</p>}
          {error && <p role="alert" className={styles.error}><WarningCircle size={19} aria-hidden="true" />{error}</p>}
          {briefing && <div className={styles.briefing}>
            {briefing.panorama && <div><h4><Compass size={18} aria-hidden="true" />Panorama</h4><p>{briefing.panorama}</p></div>}
            <SummarySection icon={<ListChecks size={18} aria-hidden="true" />} title="Prioridades sugeridas" items={briefing.prioridades} />
            <SummarySection icon={<WarningCircle size={18} aria-hidden="true" />} title="Alertas sugeridas" items={briefing.alertas} />
            <SummarySection icon={<Lightbulb size={18} aria-hidden="true" />} title="Oportunidades sugeridas" items={briefing.oportunidades} />
          </div>}
          <p className={styles.disclaimer}>Borrador orientativo generado por IA a partir de tus datos. Revisá antes de tomar decisiones. No crea tareas ni ejecuta acciones.</p>
        </div>
        <div id={`${id}-chat-panel`} role="tabpanel" aria-labelledby={`${id}-chat-tab`} hidden={view !== 'chat'} tabIndex={0} className={styles.pane}>
          <h3 className={styles.paneTitle}><ChatCircle size={23} aria-hidden="true" />Consultas de cartera</h3>
          <p className={styles.paneCopy}>Podés empezar con una pregunta sugerida o escribir la tuya.</p>
          {mensajes.length === 0 && <div className={styles.suggestions}>
            {SUGERENCIAS.map((s) => <AppButton key={s} variant="secondary" className={styles.suggestion} onClick={() => { setPregunta(s); questionInput.current?.focus(); }}>{s}</AppButton>)}
          </div>}
          {mensajes.length > 0 && <div role="log" aria-label="Conversación de cartera" aria-live="polite" aria-relevant="additions text" className={styles.conversation}>
            {mensajes.map((m, i) => <div key={i} className={m.role === 'user' ? styles.userMessage : styles.aiMessage}><strong>{m.role === 'user' ? 'Vos' : 'Asistente IA'}</strong><p>{m.text}</p></div>)}
          </div>}
          {pensando && <p role="status" className={styles.pending}>Preparando respuesta…</p>}
          {chatError && <p role="alert" className={styles.error}><WarningCircle size={19} aria-hidden="true" />{chatError}</p>}
          <form onSubmit={(e) => { e.preventDefault(); void handlePreguntar(pregunta); }} className={styles.questionForm} aria-label="Consultar la cartera">
            <label htmlFor={`${id}-question`}>Tu pregunta</label>
            <div className={styles.editor}>
              <textarea ref={questionInput} id={`${id}-question`} value={pregunta} onChange={(e) => setPregunta(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); void handlePreguntar(pregunta); }
              }} rows={4} placeholder="¿Qué te gustaría revisar en tu cartera?" aria-describedby={`${id}-question-help`} />
              <div className={styles.sendRow}><span id={`${id}-question-help`}>Enter para consultar · Shift+Enter para una nueva línea</span>
                <AppButton type="submit" className={styles.primaryAction} disabled={pensando || !pregunta.trim()}>Consultar<ArrowRight size={17} aria-hidden="true" /></AppButton>
              </div>
            </div>
          </form>
          <p className={styles.disclaimer}>La respuesta usa un contexto limitado y no reemplaza la revisión de los módulos. Las coincidencias sugeridas no son confirmaciones comerciales.</p>
        </div>
        <footer className={styles.intelligenceFooter}><ShieldCheck size={17} aria-hidden="true" />La asistencia no modifica tus registros.</footer>
      </div>
    </Surface>
  );
}

function SummarySection({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  if (!items?.length) return null;
  return <div><h4>{icon}{title}</h4><ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div>;
}
