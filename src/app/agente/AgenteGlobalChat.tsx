'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Buildings,
  LockKey,
  LockSimple,
  PaperPlaneTilt,
  Sparkle,
  Waves,
} from '@phosphor-icons/react';
import { preguntarAgenteGlobal } from './actions';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import type { MensajeChat, AccionPropuesta } from '@/lib/ai/agente';
import { getAgentDisclaimer } from '@/lib/industries/disclaimers';
import { AppButton } from '@/components/ui/AppButton';
import styles from './Agent.module.css';
import { AnulusAgentAvatar } from '@/components/agent/AnulusAgentAvatar';

type MensajeUI = MensajeChat & { acciones?: AccionPropuesta[] };

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
  });
}

function MensajeTexto({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  const bloques: ReactNode[] = [];
  let lista: string[] = [];
  let key = 0;

  const flushLista = () => {
    if (!lista.length) return;
    const items = [...lista];
    bloques.push(
      <ul key={`ul-${key++}`} className="my-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`li-${key}-${index}`} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-current" />
            <span>{renderInline(item, `li-${key}-${index}`)}</span>
          </li>
        ))}
      </ul>
    );
    lista = [];
  };

  for (const linea of lineas) {
    const text = linea.trim();
    if (!text) {
      flushLista();
      continue;
    }
    const bullet = text.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      lista.push(bullet[1]);
    } else {
      flushLista();
      bloques.push(
        <p key={`p-${key++}`} className="my-1.5">
          {renderInline(text, `p-${key}`)}
        </p>
      );
    }
  }
  flushLista();
  return <div>{bloques}</div>;
}

type Props = { industry: string; puedeUsarIA: boolean };

function agentTitle(industry: IndustryType) {
  if (industry === 'inmobiliaria') return 'Agente Anulus inmobiliario';
  if (industry === 'escribania') return 'Agente Anulus notarial';
  if (industry === 'legal') return 'Agente Anulus jurídico';
  return 'Agente Anulus';
}

function contextLabel(industry: IndustryType) {
  if (industry === 'inmobiliaria') return 'Guía inmobiliaria';
  if (industry === 'escribania') return 'Guía notarial';
  if (industry === 'legal') return 'Guía jurídica';
  return 'Guía de la plataforma';
}

function activationGreeting(industry: IndustryType) {
  if (industry === 'inmobiliaria') return 'Hola. ¿Qué función necesitás encontrar?';
  if (industry === 'escribania') return 'Hola. ¿Qué herramienta necesitás?';
  if (industry === 'legal') return 'Hola. ¿Dónde necesitás orientación?';
  return 'Hola. ¿Cómo te guío?';
}

export function AgenteGlobalChat({ industry, puedeUsarIA }: Props) {
  const normalizedIndustry = industry as IndustryType;
  const terms = getIndustryTerms(normalizedIndustry);
  const saludo = terms.agenteSaludoGlobal;
  const preguntas = terms.agentePreguntasGlobales;
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [avatarGreeting, setAvatarGreeting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [mensajes, cargando]);

  useEffect(() => () => {
    if (greetingTimer.current) clearTimeout(greetingTimer.current);
  }, []);

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setError(null);
    const historialPrevio = mensajes.map((message) => ({ rol: message.rol, texto: message.texto }));
    setMensajes((previous) => [...previous, { rol: 'user', texto: pregunta }]);
    setInput('');
    setCargando(true);
    try {
      const response = await preguntarAgenteGlobal({ historial: historialPrevio, pregunta });
      if (response.ok) {
        setMensajes((previous) => [
          ...previous,
          { rol: 'model', texto: response.respuesta, acciones: response.acciones },
        ]);
      } else {
        setError(response.motivo);
      }
    } catch {
      setError('Hubo un error de conexión. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  function activateAgent() {
    setAvatarGreeting(true);
    inputRef.current?.focus();
    if (greetingTimer.current) clearTimeout(greetingTimer.current);
    greetingTimer.current = setTimeout(() => setAvatarGreeting(false), 2600);
  }

  if (!puedeUsarIA) return null;

  const iniciado = mensajes.length > 0;
  const visualState = cargando
    ? 'thinking'
    : inputFocused
      ? 'listening'
      : iniciado
        ? 'attentive'
        : 'idle';

  return <section className={styles.agentMain}>
    <header className={styles.agentHead}>
      <div className={styles.avatarSlot}>
        <AnulusAgentAvatar industry={normalizedIndustry} state={visualState} compact={iniciado}
          onActivate={activateAgent} showHint={!avatarGreeting} className={styles.avatar} />
        {avatarGreeting ? <p role="status" className={styles.activationHint}>{activationGreeting(normalizedIndustry)}</p> : null}
      </div>
      <div className={styles.agentIdentity}>
        <p className={styles.eyebrow}>Guía general de Anulus</p><h1>{agentTitle(normalizedIndustry)}</h1>
        <p className={styles.saludo}>{saludo}</p>
        <div className={styles.agentMeta}><span><Buildings size={13} aria-hidden="true" />{contextLabel(normalizedIndustry)}</span>
          <span><LockKey size={13} aria-hidden="true" />Conversación temporal</span></div>
      </div>
    </header>
    <div className={styles.agentBody}>
      {!iniciado ? <>
        <div className={styles.orientation}><Sparkle size={21} aria-hidden="true" /><div>
          <h2>¿En qué parte de Anulus te ayudo?</h2>
          <p>Puedo mostrarte dónde está cada función y cómo recorrer la plataforma. Para analizar un caso concreto, abrí {terms.unExpediente} y usá su agente contextual.</p>
        </div></div>
        <div className={styles.questions}>{preguntas.map((question:string) => <AppButton key={question} variant="secondary"
          onClick={() => enviar(question)} className={styles.question}><span>{question}</span><ArrowRight size={15} aria-hidden="true" /></AppButton>)}</div>
      </> : null}
      {iniciado ? <div ref={scrollRef} role="log" aria-live="polite" aria-label="Conversación con el agente" className={styles.conversation}>
        {mensajes.map((message,index) => <div key={`${message.rol}-${index}`} className={`${styles.message} ${message.rol === 'user' ? styles.user : styles.model}`}>
          <span className={styles.speaker}>{message.rol === 'user' ? 'Vos' : 'Agente Anulus'}</span>
          {message.rol === 'user' ? <p>{message.texto}</p> : <MensajeTexto texto={message.texto} />}
        </div>)}
        {cargando ? <div role="status" className={styles.responseState}><Waves size={17} aria-hidden="true" />Analizando el panorama…</div> : null}
      </div> : null}
      {error ? <p role="alert" className={styles.chatError}>{error}</p> : null}
      <form onSubmit={event => {event.preventDefault(); enviar(input);}} className={styles.composer}>
        <label htmlFor="agent-global-query">Tu consulta</label>
        <div className={styles.composerBox}>
          <textarea id="agent-global-query" ref={inputRef} value={input} onChange={event => setInput(event.target.value)}
            onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
            onKeyDown={event => {if(event.key === 'Enter' && !event.shiftKey){event.preventDefault();enviar(input);}}}
            rows={2} aria-label="Escribir una consulta para el Agente Anulus" placeholder="Escribí tu consulta…" />
          <AppButton type="submit" aria-label="Enviar consulta" disabled={cargando || !input.trim()} className={styles.send}>
            <span>Enviar</span><PaperPlaneTilt size={16} weight="regular" aria-hidden="true" />
          </AppButton>
        </div>
        <p className={styles.inputHint}><span><LockSimple size={12} aria-hidden="true" />Sesión temporal: el historial se borra al salir.</span><span>Enter para enviar · Shift + Enter para nueva línea</span></p>
        <p className={styles.disclaimer}><strong>Uso responsable:</strong> {getAgentDisclaimer(industry)}</p>
      </form>
    </div>
  </section>;
}
