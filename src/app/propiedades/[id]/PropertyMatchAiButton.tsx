'use client';

import { useState, useTransition } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import { analizarMatchPropiedadIA } from '../actions';

export function PropertyMatchAiButton({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await analizarMatchPropiedadIA(propertyId);
        if (res.ok && res.text) {
          setResult(res.text);
        } else {
          setError(res.error || 'Ocurrió un error inesperado al analizar el matching.');
        }
      } catch (err) {
        setError('Ocurrió un error inesperado.');
      }
    });
  };

  if (result) {
    return (
      <div className="mb-6 rounded-2xl border border-[#29C5FF]/30 bg-gradient-to-br from-[#1E9BF0]/10 to-[#0A1830] p-6 shadow-[0_0_20px_rgba(30,155,240,0.15)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Sparkles className="h-5 w-5" />
            <h4 className="font-display text-lg font-bold">Análisis de Candidatos (IA)</h4>
          </div>
          <button 
            onClick={() => setResult(null)} 
            className="text-slate-400 hover:text-white transition-colors"
            title="Ocultar análisis"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {result}
        </div>
        
        <div className="mt-4 flex items-center justify-between border-t border-cyan-500/20 pt-4">
          <p className="text-xs text-cyan-500/70 italic">
            Sugerencia generada por IA — revisá antes de ofrecer.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isPending}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
          >
            {isPending ? 'Reanalizando...' : 'Volver a analizar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <button
        onClick={handleAnalyze}
        disabled={isPending}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-[#1E9BF0] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-cyan-500/25 disabled:pointer-events-none disabled:opacity-70"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
        <Bot className={`h-4 w-4 ${isPending ? 'animate-pulse' : ''}`} />
        <span>{isPending ? 'Analizar clientes...' : 'Analizar con IA'}</span>
      </button>
    </div>
  );
}
