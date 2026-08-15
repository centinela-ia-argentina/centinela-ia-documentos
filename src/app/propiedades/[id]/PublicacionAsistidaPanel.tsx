'use client';

import { useFormStatus } from 'react-dom';
import { actualizarPublicacion } from '../actions';
import { ExternalLink, Globe, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { PropertyRecord } from '@/types/property';
import { getPropertyTypeLabel } from '@/lib/properties/labels';

interface PublicacionAsistidaPanelProps {
  property: PropertyRecord;
  canManage: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
    >
      {pending ? 'Guardando...' : 'Guardar enlaces'}
    </button>
  );
}

export function PublicacionAsistidaPanel({ property, canManage }: PublicacionAsistidaPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

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

      <form action={async (fd) => { await actualizarPublicacion(fd); }} className="space-y-4">
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
              defaultValue={property.publication_notes ?? ''}
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
              <input name="publication_url_mercadolibre" type="url" defaultValue={property.publication_url_mercadolibre ?? ''} disabled={!canManage} placeholder="https://inmueble.mercadolibre.com.ar/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {property.publication_url_mercadolibre && (
                <a href={property.publication_url_mercadolibre} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Zonaprop</span>
              <input name="publication_url_zonaprop" type="url" defaultValue={property.publication_url_zonaprop ?? ''} disabled={!canManage} placeholder="https://www.zonaprop.com.ar/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {property.publication_url_zonaprop && (
                <a href={property.publication_url_zonaprop} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Argenprop</span>
              <input name="publication_url_argenprop" type="url" defaultValue={property.publication_url_argenprop ?? ''} disabled={!canManage} placeholder="https://www.argenprop.com/..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {property.publication_url_argenprop && (
                <a href={property.publication_url_argenprop} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs font-medium text-slate-300">Otro / Redes</span>
              <input name="publication_url_other" type="url" defaultValue={property.publication_url_other ?? ''} disabled={!canManage} placeholder="https://..." className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-400" />
              {property.publication_url_other && (
                <a href={property.publication_url_other} target="_blank" rel="noopener noreferrer" className="p-2 text-cyan-400 hover:text-cyan-300"><ExternalLink className="h-4 w-4" /></a>
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
          <div className="flex justify-end pt-4 border-t border-white/10">
            <SubmitButton />
          </div>
        )}
      </form>
    </div>
  );
}
