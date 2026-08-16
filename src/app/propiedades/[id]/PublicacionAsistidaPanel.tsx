'use client';

import { ExternalLink, Globe, Copy, Check, Info } from 'lucide-react';
import { useState } from 'react';
import type { PropertyRecord } from '@/types/property';
import { getPropertyTypeLabel } from '@/lib/properties/labels';

interface PublicacionAsistidaPanelProps {
  property: PropertyRecord;
  canManage: boolean;
}

export function PublicacionAsistidaPanel({ property, canManage }: PublicacionAsistidaPanelProps) {
  const [status, setStatus] = useState(property.publication_status ?? 'no_publicada');
  const [notes, setNotes] = useState(property.publication_notes ?? '');
  const [urlMercadoLibre, setUrlMercadoLibre] = useState(property.publication_url_mercadolibre ?? '');
  const [urlZonaprop, setUrlZonaprop] = useState(property.publication_url_zonaprop ?? '');
  const [urlArgenprop, setUrlArgenprop] = useState(property.publication_url_argenprop ?? '');
  const [urlOther, setUrlOther] = useState(property.publication_url_other ?? '');

  const [copied, setCopied] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/propiedades/${property.id}/publicacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_status: status,
          publication_notes: notes,
          publication_url_mercadolibre: urlMercadoLibre,
          publication_url_zonaprop: urlZonaprop,
          publication_url_argenprop: urlArgenprop,
          publication_url_other: urlOther
        })
      });

      const res = await response.json();

      if (response.ok && res.publication) {
        setStatus(res.publication.publication_status ?? 'no_publicada');
        setNotes(res.publication.publication_notes ?? '');
        setUrlMercadoLibre(res.publication.publication_url_mercadolibre ?? '');
        setUrlZonaprop(res.publication.publication_url_zonaprop ?? '');
        setUrlArgenprop(res.publication.publication_url_argenprop ?? '');
        setUrlOther(res.publication.publication_url_other ?? '');

        setFeedback({ type: 'success', text: 'Publicación actualizada' });
        // Hide success message after 3 seconds
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', text: res.error || 'Error al guardar' });
      }
    } catch (e) {
      setFeedback({ type: 'error', text: 'Error inesperado al guardar' });
    } finally {
      setIsSaving(false);
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const titleText = property.name;
  const descText = `📍 Ubicación: ${[property.address, property.neighborhood, property.city].filter(Boolean).join(', ')}
🏠 Tipo: ${getPropertyTypeLabel(property.property_type)}
📐 Superficie: ${property.surface_total_m2 ? `${property.surface_total_m2} m² totales` : ''} ${property.surface_covered_m2 ? `(${property.surface_covered_m2} m² cubiertos)` : ''}
🚪 Ambientes: ${property.rooms || '-'}
💰 Valor: ${property.currency === 'USD' ? 'u$s' : '$'} ${property.price?.toLocaleString('es-AR') || 'Consultar'}

Para más información, contactanos.`;
  const hashtagsText = `#Inmobiliaria #RealEstate #${getPropertyTypeLabel(property.property_type)?.replace(/\s+/g, '')} ${property.neighborhood ? `#${property.neighborhood.replace(/\s+/g, '')}` : ''} #Oportunidad`;

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 mt-6">
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Publicación Asistida (Manual)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Registrá los enlaces donde publicaste manualmente esta propiedad. El sistema no publica automáticamente en los portales.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="property_id" value={property.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Estado de publicación</label>
            <input type="hidden" name="publication_status" value={status} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!canManage}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="no_publicada" className="bg-[#0C2340]">No publicada</option>
              <option value="en_preparacion" className="bg-[#0C2340]">En preparación</option>
              <option value="publicada" className="bg-[#0C2340]">Publicada</option>
              <option value="pausada" className="bg-[#0C2340]">Pausada / Finalizada</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Notas de publicación</label>
            <input
              name="publication_notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canManage}
              placeholder="Ej. Falta renovar cartel"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-xs font-semibold text-slate-400">Enlaces a portales</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">MercadoLibre</span>
              <input name="publication_url_mercadolibre" type="url" value={urlMercadoLibre} onChange={(e) => setUrlMercadoLibre(e.target.value)} disabled={!canManage} placeholder="https://inmueble.mercadolibre.com.ar/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {urlMercadoLibre && (
                <a href={urlMercadoLibre} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Zonaprop</span>
              <input name="publication_url_zonaprop" type="url" value={urlZonaprop} onChange={(e) => setUrlZonaprop(e.target.value)} disabled={!canManage} placeholder="https://www.zonaprop.com.ar/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {urlZonaprop && (
                <a href={urlZonaprop} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Argenprop</span>
              <input name="publication_url_argenprop" type="url" value={urlArgenprop} onChange={(e) => setUrlArgenprop(e.target.value)} disabled={!canManage} placeholder="https://www.argenprop.com/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {urlArgenprop && (
                <a href={urlArgenprop} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Otro / Redes</span>
              <input name="publication_url_other" type="url" value={urlOther} onChange={(e) => setUrlOther(e.target.value)} disabled={!canManage} placeholder="https://..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {urlOther && (
                <a href={urlOther} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/10">
          <label className="block text-xs font-semibold text-slate-400">Copiar textos rápidos</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleCopy('title', titleText)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">
              {copied === 'title' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Título
            </button>
            <button type="button" onClick={() => handleCopy('desc', descText)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">
              {copied === 'desc' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Descripción Básica
            </button>
            <button type="button" onClick={() => handleCopy('tags', hashtagsText)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">
              {copied === 'tags' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Hashtags
            </button>
          </div>
          <p className="text-[10px] text-slate-500">O usá "Generar aviso con IA" para un texto publicitario más completo.</p>
        </div>

        {canManage && (
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
            {feedback && (
              <span className={`text-sm ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {feedback.text}
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar enlaces'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
