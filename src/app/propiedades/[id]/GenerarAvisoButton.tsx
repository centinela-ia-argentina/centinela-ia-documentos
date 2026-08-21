'use client';

import { useState, useTransition } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Bot, Sparkles, X, Copy, Check } from 'lucide-react';
import { generarAvisoPropiedadIA } from '../actions';
import { AiDisclaimer } from '@/lib/industries/disclaimers';

export function GenerarAvisoButton({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const res = await generarAvisoPropiedadIA(propertyId);
        if (res.ok && res.text) {
          setResult(res.text);
        } else {
          setError(res.error || 'Ocurrió un error inesperado al generar el aviso.');
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        setError('Ocurrió un error inesperado.');
      }
    });
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (result) {
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Sparkles className="h-5 w-5" />
            <h4 className="font-display text-lg font-bold text-white">Aviso generado por IA</h4>
          </div>
          <button 
            onClick={() => setResult(null)} 
            className="text-slate-400 hover:text-white transition-colors"
            title="Cerrar aviso"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-black/20 p-4 rounded-xl border border-white/5 overflow-auto max-h-96">
          {result}
        </pre>
        
        {/* Pie: aclaración arriba, botones abajo en fila pareja */}
        <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
          <AiDisclaimer industry="inmobiliaria" className="mt-0" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(result!)}`, '_blank')}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/30 transition-colors"
            >
              📲 WhatsApp
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isPending}
              className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/20 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Regenerando…' : '🔄 Regenerar'}
            </button>
          </div>
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
        className="group relative inline-flex w-full justify-center items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-cyan-500/25 disabled:pointer-events-none disabled:opacity-70"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
        <Sparkles className={`h-4 w-4 ${isPending ? 'animate-pulse' : ''}`} />
        <span>{isPending ? 'Generando aviso...' : '✨ Generar aviso con IA'}</span>
      </button>
    </div>
  );
}
