'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, FileText, CheckCircle2, X } from 'lucide-react';
import { extraerDatosPropiedadIA, aplicarDatosIAPropiedad } from '../actions';
import type { PropertyExtraction } from '@/lib/ai/extraerPropiedad';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

interface DocumentOption {
  id: string;
  file_name: string;
}

interface PropertyAiAssistantProps {
  propertyId: string;
  documents: DocumentOption[];
}

export function PropertyAiAssistant({ propertyId, documents }: PropertyAiAssistantProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [isPending, startTransition] = useTransition();
  const [extractedData, setExtractedData] = useState<PropertyExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="h-6 w-6 text-brandviolet" />
          <h2 className="text-xl font-bold text-white">Autocompletar con IA</h2>
        </div>
        <p className="text-sm text-slate-400">
          Subí un documento a la Bóveda (título, boleto, contrato) para que la IA lea y complete los datos de la ficha automáticamente.
        </p>
        <div className="mt-4">
          <Link href="/documentos/subir">
            <button className="rounded-xl border border-brandviolet/30 bg-brandviolet/10 px-4 py-2 text-sm font-bold text-brandviolet transition-colors hover:bg-brandviolet/20">
              Subir documento
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const handleExtract = () => {
    if (!selectedDocId) return;
    setError(null);
    setExtractedData(null);

    startTransition(async () => {
      try {
        const res = await extraerDatosPropiedadIA(propertyId, selectedDocId);
        if (res.ok && res.data) {
          setExtractedData(res.data);
        } else {
          setError(res.error || 'Ocurrió un error al analizar el documento');
        }
      } catch (e: any) {
        setError(e.message || 'Error desconocido');
      }
    });
  };

  const hasData = extractedData && Object.values(extractedData).some(val => val !== null && val !== '');

  return (
    <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-brandviolet/5 p-6 sm:p-8 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-6 w-6 text-cyan-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Autocompletar con IA</h2>
          <p className="text-sm text-slate-400">Seleccioná un documento de la bóveda para extraer datos.</p>
        </div>
      </div>

      {!extractedData && (
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-[#0C2340] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400"
            disabled={isPending}
          >
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>{doc.file_name}</option>
            ))}
          </select>
          <button
            onClick={handleExtract}
            disabled={isPending || !selectedDocId}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-brandviolet px-6 py-3 font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {isPending ? 'Leyendo...' : 'Leer con IA'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {extractedData && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-cyan-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Sugerencias de la IA detectadas
            </h3>
            <button
              onClick={() => setExtractedData(null)}
              className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" /> Descartar
            </button>
          </div>

          {!hasData ? (
            <p className="text-sm text-slate-400">No se encontraron datos útiles en el documento seleccionado.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                {Object.entries(extractedData).map(([key, value]) => {
                  if (value === null || value === '') return null;
                  return (
                    <div key={key} className="rounded-xl border border-cyan-500/20 bg-[#071326]/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-sm font-medium text-white truncate" title={String(value)}>
                        {String(value)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <form
                action={aplicarDatosIAPropiedad}
                onSubmit={(e) => {
                  if (!window.confirm('La IA va a completar la ficha con los datos detectados. Vas a poder revisarlos y editarlos después. ¿Aplicar?')) {
                    e.preventDefault();
                  }
                }}
                className="flex justify-end"
              >
                <input type="hidden" name="property_id" value={propertyId} />
                <input type="hidden" name="direccion" value={extractedData.direccion || ''} />
                <input type="hidden" name="tipo_propiedad" value={extractedData.tipo_propiedad || ''} />
                <input type="hidden" name="matricula" value={extractedData.matricula || ''} />
                <input type="hidden" name="superficie_total_m2" value={extractedData.superficie_total_m2 || ''} />
                <input type="hidden" name="superficie_cubierta_m2" value={extractedData.superficie_cubierta_m2 || ''} />
                <input type="hidden" name="ambientes" value={extractedData.ambientes || ''} />
                <input type="hidden" name="titulares" value={extractedData.titulares || ''} />
                <input type="hidden" name="gravamenes" value={extractedData.gravamenes || ''} />
                <input type="hidden" name="observaciones" value={extractedData.observaciones || ''} />
                
                <FormSubmitButton label="Aplicar a la ficha" loadingLabel="Aplicando..." />
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
