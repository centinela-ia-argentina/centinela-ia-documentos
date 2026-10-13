'use client';

import { ArrowRight } from 'lucide-react';
import { Sparkle } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import styles from './PropertyDetail.module.css';

import { useState, useTransition } from 'react';
import { Sparkles, X, Copy, Check } from 'lucide-react';
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
      <AppButton onClick={handleAnalyze} disabled={isPending} className={styles.primary}>
        <Sparkle size={18} weight="duotone" aria-hidden="true" />
        {isPending ? 'Generando aviso…' : 'Preparar aviso con IA'}
        <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />
      </AppButton>
    </div>
  );
}
