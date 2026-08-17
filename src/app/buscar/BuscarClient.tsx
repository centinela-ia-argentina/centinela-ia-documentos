'use client';

import { useState } from 'react';
import Link from 'next/link';
import { preguntarADocumentos, type FuenteBusqueda } from './actions';
import { AvisoPrivacidadIA } from '@/components/AvisoPrivacidadIA';
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import { MotionButton } from '@/components/ui/MotionButton';
import { MotionCard } from '@/components/ui/MotionCard';

export function BuscarClient() {
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<FuenteBusqueda[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
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

  return (
    <div>
      <AvisoPrivacidadIA contexto="responder tu pregunta" />
      <AiDisclaimer industry="inmobiliaria" className="mb-4" />
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ej: ¿Qué plazo tiene la notificación de Tiendas Tech?"
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
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-300">
                    [{i + 1}] {f.fileName}
                  </span>
                  <Link
                    href={`/documentos/${f.documentId}`}
                    className="shrink-0 text-xs font-semibold text-cyan-400 hover:underline"
                  >
                    Ver documento →
                  </Link>
                </div>
                <p className="mt-1 line-clamp-3 text-xs text-slate-400">{f.fragmento}</p>
              </li>
            ))}
          </ol>
        </MotionCard>
      )}
    </div>
  );
}
