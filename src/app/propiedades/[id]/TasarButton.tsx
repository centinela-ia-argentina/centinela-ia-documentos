'use client';

import { ArrowRight } from 'lucide-react';
import { MagicWand } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import styles from './PropertyDetail.module.css';

import { useState, useTransition } from 'react';
import { Calculator, X, Copy, Check } from 'lucide-react';
import { tasarPropiedadConIA } from '../actions';
import { AiDisclaimer } from '@/lib/industries/disclaimers';

export function TasarButton({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTasar = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const res = await tasarPropiedadConIA(propertyId);
        if (res.ok && res.text) {
          setResult(res.text);
        } else {
          setError(res.error || 'Ocurrió un error inesperado al tasar.');
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
            <Calculator className="h-5 w-5" />
            <h4 className="font-display text-lg font-bold text-white">Tasación por IA</h4>
          </div>
          <button 
            onClick={() => setResult(null)} 
            className="text-slate-400 hover:text-white transition-colors"
            title="Cerrar tasación"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-black/20 p-4 rounded-xl border border-white/5 overflow-auto max-h-96">
          {result}
        </pre>
        
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <AiDisclaimer industry="inmobiliaria" className="mt-0 flex-1 mr-4" />
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : '📋 Copiar'}
            </button>
            <button
              onClick={handleTasar}
              disabled={isPending}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
            >
              {isPending ? 'Retasando...' : 'Retasar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-red-400">No se pudo tasar</h4>
              <p className="mt-1 text-sm text-red-200/80">{error}</p>
            </div>
          </div>
        </div>
      )}
      <AppButton onClick={handleTasar} disabled={isPending} className={styles.primary}>
        <MagicWand size={18} weight="duotone" aria-hidden="true" />
        {isPending ? 'Tasando…' : 'Preparar estimación con IA'}
        <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />
      </AppButton>
    </div>
  );
}
