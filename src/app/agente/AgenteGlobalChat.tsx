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
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import { AnulusAgentAvatar } from '@/components/agent/AnulusAgentAvatar';

type MensajeUI = MensajeChat & { acciones?: AccionPropuesta[] };

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-white">
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
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#85E4D4]" />
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

  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#081A22] shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
      <div className={`grid items-center gap-6 px-5 py-6 sm:px-8 lg:px-10 ${iniciado ? 'lg:grid-cols-[170px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:py-9'}`}>
        <div className="relative flex min-h-[190px] items-center justify-center overflow-visible rounded-[26px] border border-white/[0.07] bg-[radial-gradient(circle_at_50%_35%,rgba(133,228,212,0.11),transparent_62%)] pb-7">
          <AnulusAgentAvatar
            industry={normalizedIndustry}
            state={visualState}
            compact={iniciado}
            onActivate={activateAgent}
            showHint={!avatarGreeting}
          />
          {avatarGreeting ? (
            <div role="status" className="absolute bottom-2 left-1/2 z-20 w-max max-w-[88%] -translate-x-1/2 rounded-[5px] border border-white/40 bg-[#F3F8F5] px-3 py-1.5 font-ui text-[11px] font-bold text-[#071110] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              {activationGreeting(normalizedIndustry)}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-ui text-xs font-semibold text-[#85E4D4]">Guía general de Anulus</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025))] px-2.5 py-1 font-ui text-[10px] font-semibold text-[#C5D2CE] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_18px_rgba(0,0,0,0.12)]">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#C8FF62]/25 motion-reduce:animate-none" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-[#C8FF62] shadow-[0_0_8px_rgba(200,255,98,0.8)]" />
              </span>
              En línea
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.05em] text-[#F3F8F5] sm:text-4xl">
            {agentTitle(normalizedIndustry)}
          </h1>
          <p
            className="mt-3 max-w-2xl font-ui text-sm leading-6 sm:text-base"
            style={{ color: '#AAB9B4' }}
          >
            {saludo}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <span className="inline-flex min-h-10 items-center gap-2.5 rounded-md border border-white/15 bg-white/[0.025] pl-2 pr-3 font-ui text-xs font-semibold text-[#E4ECE9] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-[#85E4D4]/10 text-[#85E4D4]">
                <Buildings size={15} weight="regular" />
              </span>
              {contextLabel(normalizedIndustry)}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2.5 rounded-md border border-white/15 bg-white/[0.025] pl-2 pr-3 font-ui text-xs font-semibold text-[#E4ECE9] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-[#85E4D4]/10 text-[#85E4D4]">
                <LockKey size={15} weight="regular" />
              </span>
              Conversación temporal
            </span>
          </div>

          {!iniciado ? (
            <>
              <div className="mt-6 flex items-start gap-3 border-y border-white/10 py-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#C8FF62]/25 bg-[#C8FF62]/[0.07] text-[#C8FF62]">
                  <Sparkle size={16} weight="fill" />
                </span>
                <div>
                  <p className="font-ui text-sm font-semibold text-[#F0F6F3]">¿En qué parte de Anulus te ayudo?</p>
                  <p className="mt-1 font-ui text-xs leading-5 text-[#869A94]">
                    Puedo mostrarte dónde está cada función y cómo recorrer la plataforma. Para analizar un caso concreto, abrí {terms.unExpediente} y usá su agente contextual.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {preguntas.map((question: string) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => enviar(question)}
                    className="group/question flex min-h-14 items-center justify-between gap-3 rounded-md border border-white/15 bg-transparent px-3.5 py-2.5 text-left font-ui text-xs font-semibold leading-4 text-[#D3DEDA] transition-[border-color,background-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-[#85E4D4]/35 hover:bg-white/[0.045] hover:text-white hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
                  >
                    <span>{question}</span>
                    <ArrowRight size={15} weight="bold" className="shrink-0 text-[#85E4D4] transition-transform duration-150 group-hover/question:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {iniciado ? (
        <div ref={scrollRef} aria-live="polite" className="max-h-[440px] space-y-4 overflow-y-auto border-t border-white/10 px-5 py-6 sm:px-8 lg:px-10">
          {mensajes.map((message, index) => (
            <div key={`${message.rol}-${index}`} className={message.rol === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              {message.rol === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-md border border-[#C8FF62]/15 bg-[#C8FF62]/[0.09] px-4 py-3 font-ui text-sm leading-6 text-[#F0F7F3]">
                  {message.texto}
                </div>
              ) : (
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-[#85E4D4]/15 bg-[#10211E] px-4 py-3 font-ui text-sm leading-6 text-[#D4DFDB]">
                  <MensajeTexto texto={message.texto} />
                </div>
              )}
            </div>
          ))}
          {cargando ? (
            <div className="flex items-center gap-2 font-ui text-xs text-[#8EA19B]">
              <Waves size={17} weight="regular" className="animate-pulse text-[#85E4D4]" />
              Analizando el panorama…
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="border-t border-rose-400/15 bg-rose-400/[0.05] px-5 py-3 font-ui text-xs text-rose-300 sm:px-8 lg:px-10">{error}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          enviar(input);
        }}
        className="border-t border-white/10 bg-[#061311]/70 px-4 py-4 sm:px-6"
      >
        <div className="rounded-xl border border-white/10 bg-[#050D0C] p-2 transition-colors focus-within:border-[#85E4D4]/35">
          <div className="flex items-center gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  enviar(input);
                }
              }}
              rows={1}
              aria-label="Escribir una consulta para el Agente Anulus"
              placeholder="Escribí tu consulta…"
              className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 font-ui text-sm leading-6 text-[#F1F6F4] outline-none placeholder:text-[#63756F]"
            />
            <button
              type="submit"
              aria-label="Enviar consulta"
              disabled={cargando || !input.trim()}
              className="group/send inline-flex h-11 shrink-0 items-center justify-center gap-2 self-center rounded-[5px] border border-white/60 bg-[#F3F8F5] px-4 font-ui text-xs font-bold text-[#071110] shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,background-color,color,opacity] duration-150 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_0_1px_rgba(200,255,98,0.24),0_0_24px_rgba(200,255,98,0.2)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/25 disabled:bg-[#D9E2DE] disabled:text-[#53625D] disabled:opacity-75 disabled:shadow-none disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
            >
              <span className="hidden sm:inline">Enviar</span>
              <PaperPlaneTilt size={16} weight="fill" className="transition-transform duration-150 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
            </button>
          </div>
          <p className="mt-1 flex items-center gap-1.5 px-3 pb-1 font-ui text-[10px] text-[#60736D]">
            <LockSimple size={12} weight="regular" />
            Sesión temporal: el historial se borra al salir.
          </p>
        </div>
        <AiDisclaimer
          industry={industry}
          context="agent"
        />
      </form>
    </section>
  );
}
