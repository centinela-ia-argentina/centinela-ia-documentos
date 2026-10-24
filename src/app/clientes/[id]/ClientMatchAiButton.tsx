'use client';

import { useState, useTransition } from 'react';
import { Sparkles, X } from 'lucide-react';
import { analizarMatchClienteIA } from '../actions';
import approved from '@/components/approved/ApprovedDetail.module.css';

export function ClientMatchAiButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await analizarMatchClienteIA(clientId);
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
      <div data-client-analysis className={approved.aiResult}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <h4 className="font-display text-lg font-bold">Análisis de Opciones (IA)</h4>
          </div>
          <button 
            onClick={() => setResult(null)} 
            className={approved.action}
            title="Ocultar análisis"
            aria-label="Ocultar análisis"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {result}
        </div>
        
        <div className="mt-4 flex items-center justify-between border-t border-cyan-500/20 pt-4">
          <p className="text-xs text-neutral-600">
            Sugerencia generada por IA — revisá antes de ofrecer.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isPending}
            className={approved.action}
          >
            {isPending ? 'Reanalizando...' : 'Volver a analizar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <button
        onClick={handleAnalyze}
        disabled={isPending}
        className={approved.action}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span>{isPending ? 'Analizando matching...' : 'Analizar con IA'}</span>
      </button>
    </div>
  );
}
