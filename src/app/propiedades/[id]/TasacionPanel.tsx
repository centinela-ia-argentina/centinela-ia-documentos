'use client';

import { useState } from 'react';
import { crearComparable, eliminarComparable } from '../actions';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, ExternalLink, X, MapPin, Search } from 'lucide-react';
import type { ComparableRecord } from '@/types/comparable';
import { TasarButton } from './TasarButton';

interface TasacionPanelProps {
  propertyId: string;
  propertyType: string;
  comparables: ComparableRecord[];
}

export function TasacionPanel({ propertyId, propertyType, comparables }: TasacionPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    
    // Basic validations
    const price = Number(formData.get('price'));
    const surface = Number(formData.get('surface_total_m2'));

    if (isNaN(price) || price <= 0) {
      setFeedback({ type: 'error', text: 'El precio debe ser mayor a 0.' });
      setIsSaving(false);
      return;
    }
    
    if (isNaN(surface) || surface <= 0) {
      setFeedback({ type: 'error', text: 'La superficie total debe ser mayor a 0.' });
      setIsSaving(false);
      return;
    }

    try {
      const res = await crearComparable(formData);
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Comparable guardado con éxito' });
        setTimeout(() => {
          setShowForm(false);
          setFeedback(null);
        }, 1500);
      } else {
        setFeedback({ type: 'error', text: res.error || 'Error al guardar el comparable' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error inesperado.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            📊 Tasación y Comparables (Testigo)
          </h3>
          <p className="mt-1 text-xs text-slate-500">Agregá comparables externos para usar en la tasación de la IA.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <Plus className="h-4 w-4" />
            Nuevo comparable
          </button>
          <TasarButton propertyId={propertyId} />
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-[#0a1120] border border-cyan-500/20 p-4">
        <div className="flex gap-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
            <InfoIcon className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-cyan-400">Beta operativa comercial</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Estimación orientativa basada en los comparables disponibles. No es una tasación oficial ni certificada y requiere revisión profesional. Las referencias externas son cargadas manualmente; el sistema no verifica por sí solo que un aviso externo continúe vigente. El resultado depende enteramente de la calidad y actualidad de los comparables proporcionados.
            </p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0C162D] p-6 shadow-2xl mt-10 mb-10">
            <button
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-6 text-xl font-bold text-white">Cargar Comparable Externo</h3>
            
            {feedback && (
              <div className={`mb-4 rounded-xl p-3 text-sm font-semibold ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <input type="hidden" name="property_id" value={propertyId} />
              <input type="hidden" name="property_type" value={propertyType} />

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fuente / Portal</label>
                  <input name="source_name" type="text" placeholder="Ej. Zonaprop, Argenprop, Colega" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">URL del Aviso</label>
                  <input name="source_url" type="url" placeholder="https://" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha de Referencia</label>
                  <input name="reference_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Provincia</label>
                  <input name="province" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ciudad / Localidad</label>
                  <input name="city" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Barrio / Zona</label>
                  <input name="neighborhood" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Subzona</label>
                  <input name="subzone" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dirección Exacta</label>
                  <input name="address" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Moneda *</label>
                  <select name="currency" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="USD" className="bg-[#0C162D]">USD</option>
                    <option value="ARS" className="bg-[#0C162D]">ARS</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio *</label>
                  <input name="price" type="number" required min="1" placeholder="Ej. 150000" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sup. Total (m²) *</label>
                  <input name="surface_total_m2" type="number" step="0.01" required min="0.1" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sup. Cubierta (m²)</label>
                  <input name="surface_covered_m2" type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ambientes</label>
                  <input name="rooms" type="number" min="1" placeholder="Ej. 3" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Observaciones</label>
                  <textarea name="notes" rows={2} placeholder="Detalles adicionales..." className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={isSaving}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar comparable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {comparables.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 mt-4">
          {comparables.map((comp) => (
            <div key={comp.id} className="relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0C162D] p-5 shadow-lg transition-all hover:border-cyan-500/50">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="mb-2"><Badge tone="accent">Comparable externo</Badge></div>
                  <h4 className="font-bold text-white text-base">
                    {comp.currency} {comp.price.toLocaleString('es-AR')}
                  </h4>
                </div>
                <div className="flex gap-1">
                  {comp.source_url && (
                    <a href={comp.source_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors" title="Abrir fuente">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      if (confirm('¿Eliminar este comparable?')) {
                        await eliminarComparable(comp.id, propertyId);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-400 mb-4 flex-grow">
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-medium">{comp.address || comp.neighborhood || comp.city || 'Dirección no especificada'}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="block text-xs text-slate-500 uppercase">Sup. Total</span>
                    <strong className="text-slate-200">{comp.surface_total_m2 ? `${comp.surface_total_m2} m²` : '-'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="block text-xs text-slate-500 uppercase">Sup. Cub.</span>
                    <strong className="text-slate-200">{comp.surface_covered_m2 ? `${comp.surface_covered_m2} m²` : '-'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="block text-xs text-slate-500 uppercase">Ambientes</span>
                    <strong className="text-slate-200">{comp.rooms || '-'}</strong>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="block text-xs text-slate-500 uppercase">Fecha</span>
                    <strong className="text-slate-200">{comp.reference_date || '-'}</strong>
                  </div>
                </div>

                <div className="mt-3 text-xs flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-slate-500">Fuente: <span className="text-slate-300 font-medium">{comp.source_name || 'Manual'}</span></span>
                  <span className="text-slate-500">Tipo: <span className="text-slate-300">{comp.property_type || '-'}</span></span>
                </div>
                
                {comp.notes && (
                  <div className="mt-2 text-xs bg-white/5 p-2 rounded-lg italic text-slate-400">
                    "{comp.notes}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-8 text-center mt-4">
          <Search className="h-8 w-8 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">No hay comparables externos registrados</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">La tasación IA usará propiedades similares del sistema como testigos internos si están disponibles.</p>
        </div>
      )}
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
