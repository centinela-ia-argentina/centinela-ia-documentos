'use client';

import { useState, type ReactNode } from 'react';
import { Sparkles, Loader2, AlertTriangle, ListChecks, Lightbulb, Compass, Send, MessageCircle } from 'lucide-react';
import { generarBriefing, preguntarCopiloto } from './actions';

type Briefing = { panorama: string; prioridades: string[]; alertas: string[]; oportunidades: string[] };
type Mensaje = { role: 'user' | 'ia'; text: string };

const SUGERENCIAS = [
  '¿Qué propiedades tengo disponibles?',
  '¿Qué operaciones están en curso?',
  '¿Qué alquileres ajustan pronto?',
  '¿A qué cliente le sirve mi propiedad disponible?',
];

export function CopilotoClient() {
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);

  async function handleGenerar() {
    setLoading(true);
    setError(null);
    try {
      const res = await generarBriefing();
      if (res.ok) {
        setBriefing(res.briefing);
      } else {
        setError(
          res.motivo === 'sin_api_key'
            ? 'Falta configurar la clave de IA (GEMINI_API_KEY).'
            : res.motivo === 'sin_datos'
            ? 'Todavía no hay datos suficientes. Cargá propiedades, operaciones o clientes.'
            : 'No se pudo generar el briefing. Probá de nuevo en un momento.'
        );
      }
    } catch {
      setError('No se pudo generar el briefing. Probá de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePreguntar(texto: string) {
    const q = texto.trim();
    if (!q || pensando) return;
    setPregunta('');
    setMensajes((prev) => [...prev, { role: 'user', text: q }]);
    setPensando(true);
    try {
      const res = await preguntarCopiloto(q);
      const respuesta = res.ok
        ? res.respuesta
        : res.motivo === 'sin_api_key'
        ? 'Falta configurar la clave de IA (GEMINI_API_KEY).'
        : res.motivo === 'sin_pregunta'
        ? 'Escribí una pregunta.'
        : 'No pude responder ahora. Probá de nuevo en un momento.';
      setMensajes((prev) => [...prev, { role: 'ia', text: respuesta }]);
    } catch {
      setMensajes((prev) => [...prev, { role: 'ia', text: 'No pude responder ahora. Probá de nuevo en un momento.' }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">Generá un resumen ejecutivo del día con prioridades, alertas y oportunidades.</p>
          <button
            onClick={handleGenerar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Generando…' : briefing ? 'Regenerar briefing' : 'Generar briefing con IA'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div>
        )}

        {briefing && (
          <div className="mt-5 space-y-5">
            {briefing.panorama && (
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <Compass className="h-4 w-4" /> Panorama
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{briefing.panorama}</p>
              </div>
            )}

            <Section icon={<ListChecks className="h-4 w-4" />} title="Prioridades" items={briefing.prioridades} color="text-emerald-300" />
            <Section icon={<AlertTriangle className="h-4 w-4" />} title="Alertas" items={briefing.alertas} color="text-red-300" />
            <Section icon={<Lightbulb className="h-4 w-4" />} title="Oportunidades" items={briefing.oportunidades} color="text-violet-300" />

            <p className="pt-2 text-xs text-slate-500">Borrador orientativo generado por IA a partir de tus datos. Revisá antes de tomar decisiones.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4 text-cyan-300" /> Consultas de cartera
        </div>
        <p className="mt-1 text-xs text-slate-400">Preguntá sobre propiedades, clientes, alquileres y prioridades de la inmobiliaria.</p>

        {mensajes.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => handlePreguntar(s)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensajes.length > 0 && (
          <div className="mt-4 space-y-3">
            {mensajes.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white' : 'border border-white/10 bg-white/5 text-slate-200'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {pensando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </div>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); handlePreguntar(pregunta); }}
          className="mt-4 flex items-end gap-2"
        >
          <textarea
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePreguntar(pregunta); }
            }}
            rows={1}
            placeholder="Escribí tu pregunta…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button
            type="submit"
            disabled={pensando || !pregunta.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({ icon, title, items, color }: { icon: ReactNode; title: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${color}`}>
        {icon} {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-200">
            <span className="text-slate-500">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
