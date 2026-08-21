'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { crearComparable, eliminarComparable } from '../actions';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, ExternalLink, X, MapPin, Search, Eye } from 'lucide-react';
import type { ComparableRecord } from '@/types/comparable';
import { TasarButton } from './TasarButton';

interface TasacionPanelProps {
  propertyId: string;
  propertyType: string;
  comparables: ComparableRecord[];
}

export function TasacionPanel({ propertyId, propertyType, comparables }: TasacionPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedComp, setSelectedComp] = useState<ComparableRecord | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Bloqueo de scroll cuando hay modal abierto
  useEffect(() => {
    if (showForm || selectedComp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showForm, selectedComp]);

  // Cierre con escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        setShowForm(false);
        setSelectedComp(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSaving]);

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error inesperado.' });
    } finally {
      setIsSaving(false);
    }
  }

  const renderFormModal = () => {
    if (!mounted || !showForm) return null;
    return createPortal(
      <div 
        className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <section className="flex max-h-[90vh] w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0C162D] shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-6 bg-[#0a1120]">
            <div>
              <h3 id="modal-title" className="text-xl font-bold text-white">Nuevo comparable externo</h3>
              <p className="mt-1 text-xs text-slate-400">Completá los datos de referencia para la tasación.</p>
            </div>
            <button
              onClick={() => !isSaving && setShowForm(false)}
              className="text-slate-400 hover:text-white transition-colors"
              disabled={isSaving}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="overflow-y-auto p-6 flex-grow">
            {feedback && (
              <div className={`mb-6 rounded-xl p-3 text-sm font-semibold ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {feedback.text}
              </div>
            )}

            <form id="comparable-form" onSubmit={handleSubmit} className="space-y-6">
              <input type="hidden" name="property_id" value={propertyId} />
              <input type="hidden" name="property_type" value={propertyType} />

              <div className="grid gap-4 md:grid-cols-2">
                {/* FILA 1 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Fuente / Portal</label>
                  <input name="source_name" type="text" placeholder="Ej. Zonaprop, Argenprop, Colega" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo de propiedad</label>
                  <input type="text" value={propertyType} disabled className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
                </div>

                {/* FILA 2 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de Referencia</label>
                  <input name="reference_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">URL de la fuente</label>
                  <input name="source_url" type="url" placeholder="https://" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 3 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Provincia</label>
                  <input name="province" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Ciudad / Localidad</label>
                  <input name="city" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 4 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Barrio / Zona</label>
                  <input name="neighborhood" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Subzona</label>
                  <input name="subzone" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 5 */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Dirección Exacta</label>
                  <input name="address" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 6 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Moneda *</label>
                  <select name="currency" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="USD" className="bg-[#0C162D]">USD</option>
                    <option value="ARS" className="bg-[#0C162D]">ARS</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Precio *</label>
                  <input name="price" type="number" required min="1" placeholder="Ej. 150000" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 7 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Sup. Total (m²) *</label>
                  <input name="surface_total_m2" type="number" step="0.01" required min="0.1" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Sup. Cubierta (m²)</label>
                  <input name="surface_covered_m2" type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 8 */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Ambientes</label>
                  <input name="rooms" type="number" min="1" placeholder="Ej. 3" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  {/* Espacio reservado / complementario */}
                </div>

                {/* FILA 9 */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Observaciones</label>
                  <textarea name="notes" rows={2} placeholder="Detalles adicionales..." className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>
            </form>
          </div>
          
          <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 p-6 bg-[#0a1120]">
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
              form="comparable-form"
              disabled={isSaving}
              className="rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar comparable'}
            </button>
          </div>
        </section>
      </div>,
      document.body
    );
  };

  const renderDetailModal = () => {
    if (!mounted || !selectedComp) return null;
    return createPortal(
      <div 
        className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <section className="flex max-h-[90vh] w-[min(800px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0C162D] shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-6 bg-[#0a1120]">
            <div>
              <div className="mb-2"><Badge tone="accent">Comparable externo</Badge></div>
              <h3 id="detail-title" className="text-xl font-bold text-white">Detalle de la propiedad</h3>
            </div>
            <button
              onClick={() => setSelectedComp(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="overflow-y-auto p-6 flex-grow space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Precio</span>
                  <strong className="text-2xl font-bold text-white">{selectedComp.currency} {selectedComp.price.toLocaleString('es-AR')}</strong>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Dirección</span>
                  <p className="text-sm text-slate-300">{selectedComp.address || selectedComp.neighborhood || selectedComp.city || 'No especificada'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Barrio / Zona</span>
                    <p className="text-sm text-slate-300">{selectedComp.neighborhood || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Subzona</span>
                    <p className="text-sm text-slate-300">{selectedComp.subzone || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Ciudad</span>
                    <p className="text-sm text-slate-300">{selectedComp.city || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Provincia</span>
                    <p className="text-sm text-slate-300">{selectedComp.province || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Fuente</span>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-300">{selectedComp.source_name || 'Manual'}</p>
                    {selectedComp.source_url && (
                      <a href={selectedComp.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 truncate max-w-[200px]">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">Abrir enlace</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de Referencia</span>
                    <p className="text-sm text-slate-300">{selectedComp.reference_date || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</span>
                    <p className="text-sm text-slate-300">{selectedComp.property_type || '-'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4 bg-white/5 rounded-xl p-3">
                  <div className="text-center">
                    <span className="block text-[10px] text-slate-500 uppercase">Total</span>
                    <strong className="text-sm text-slate-200">{selectedComp.surface_total_m2 ? `${selectedComp.surface_total_m2} m²` : '-'}</strong>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-slate-500 uppercase">Cubierta</span>
                    <strong className="text-sm text-slate-200">{selectedComp.surface_covered_m2 ? `${selectedComp.surface_covered_m2} m²` : '-'}</strong>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-slate-500 uppercase">Amb.</span>
                    <strong className="text-sm text-slate-200">{selectedComp.rooms || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {selectedComp.notes && (
              <div className="mt-6">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Observaciones</span>
                <p className="text-sm text-slate-300 italic bg-white/5 p-4 rounded-xl border border-white/10">{selectedComp.notes}</p>
              </div>
            )}
          </div>
          
          <div className="flex shrink-0 justify-end border-t border-white/10 p-6 bg-[#0a1120]">
            <button
              type="button"
              onClick={() => setSelectedComp(null)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </section>
      </div>,
      document.body
    );
  };

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

      {comparables.length > 0 ? (
        <div className="flex flex-col gap-3 mt-4">
          {comparables.map((comp) => (
            <div key={comp.id} className="group relative flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-white/10 bg-[#0C162D] p-4 shadow-sm transition-all hover:border-cyan-500/50">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="mb-2"><Badge tone="accent">Comparable externo</Badge></div>
                  <span className="text-xs text-slate-500 mb-2">{comp.source_name || 'Manual'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                  <h4 className="font-bold text-white text-lg">
                    {comp.currency} {comp.price.toLocaleString('es-AR')}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-slate-400 line-clamp-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{comp.address || comp.neighborhood || comp.city || 'Sin dirección'}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span>Sup: <strong className="text-slate-300">{comp.surface_total_m2 ? `${comp.surface_total_m2}m²` : '-'}</strong></span>
                  {comp.rooms && <span>Amb: <strong className="text-slate-300">{comp.rooms}</strong></span>}
                  <span>Ref: <strong className="text-slate-300">{comp.reference_date || '-'}</strong></span>
                </div>
              </div>
              
              <div className="mt-4 sm:mt-0 flex shrink-0 items-center gap-2 sm:ml-4">
                <button
                  onClick={() => setSelectedComp(comp)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-400 hover:bg-white/10 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  Ver detalle
                </button>
                <button
                  onClick={async () => {
                    if (confirm('¿Eliminar este comparable?')) {
                      await eliminarComparable(comp.id, propertyId);
                    }
                  }}
                  className="rounded-lg bg-white/5 p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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

      {renderFormModal()}
      {renderDetailModal()}
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
