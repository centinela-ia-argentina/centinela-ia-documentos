'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { crearComparable, eliminarComparable } from '../actions';
import { Badge } from '@/components/ui/Badge';
import { Trash2, ExternalLink, X, MapPin, Search, ArrowRight } from 'lucide-react';
import { ChartLineUp, PlusCircle } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import styles from './PropertyDetail.module.css';
import type { ComparableRecord } from '@/types/comparable';
import { TasarButton } from './TasarButton';

interface TasacionPanelProps {
  propertyId: string;
  propertyType: string;
  comparables: ComparableRecord[];
  canManage: boolean;
  useAi: boolean;
}

export function TasacionPanel({ propertyId, propertyType, comparables, canManage, useAi }: TasacionPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedComp, setSelectedComp] = useState<ComparableRecord | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Restore the original scroll/focus state, including when the component unmounts.
  useEffect(() => {
    if (!showForm && !selectedComp) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>(`.${styles.modal}`);
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href]') ?? []);
    controls()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', trapFocus); previousFocus?.focus(); };
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
        className={`${styles.modal} fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm`}
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
              aria-label="Cerrar nuevo comparable"
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
                  <label htmlFor="comparable-source_name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Fuente / Portal</label>
                  <input id="comparable-source_name" name="source_name" type="text" placeholder="Ej. Zonaprop, Argenprop, Colega" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo de propiedad</label>
                  <input type="text" value={propertyType} disabled className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
                </div>

                {/* FILA 2 */}
                <div>
                  <label htmlFor="comparable-reference_date" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de Referencia</label>
                  <input id="comparable-reference_date" name="reference_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label htmlFor="comparable-source_url" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">URL de la fuente</label>
                  <input id="comparable-source_url" name="source_url" type="url" placeholder="https://" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 3 */}
                <div>
                  <label htmlFor="comparable-province" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Provincia</label>
                  <input id="comparable-province" name="province" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label htmlFor="comparable-city" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Ciudad / Localidad</label>
                  <input id="comparable-city" name="city" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 4 */}
                <div>
                  <label htmlFor="comparable-neighborhood" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Barrio / Zona</label>
                  <input id="comparable-neighborhood" name="neighborhood" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label htmlFor="comparable-subzone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Subzona</label>
                  <input id="comparable-subzone" name="subzone" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 5 */}
                <div className="md:col-span-2">
                  <label htmlFor="comparable-address" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Dirección Exacta</label>
                  <input id="comparable-address" name="address" type="text" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 6 */}
                <div>
                  <label htmlFor="comparable-currency" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Moneda *</label>
                  <select id="comparable-currency" name="currency" required className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="USD" className="bg-[#0C162D]">USD</option>
                    <option value="ARS" className="bg-[#0C162D]">ARS</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="comparable-price" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Precio *</label>
                  <input id="comparable-price" name="price" type="number" required min="1" placeholder="Ej. 150000" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 7 */}
                <div>
                  <label htmlFor="comparable-surface_total_m2" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Sup. Total (m²) *</label>
                  <input id="comparable-surface_total_m2" name="surface_total_m2" type="number" step="0.01" required min="0.1" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label htmlFor="comparable-surface_covered_m2" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Sup. Cubierta (m²)</label>
                  <input id="comparable-surface_covered_m2" name="surface_covered_m2" type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>

                {/* FILA 8 */}
                <div>
                  <label htmlFor="comparable-rooms" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Ambientes</label>
                  <input id="comparable-rooms" name="rooms" type="number" min="1" placeholder="Ej. 3" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  {/* Espacio reservado / complementario */}
                </div>

                {/* FILA 9 */}
                <div className="md:col-span-2">
                  <label htmlFor="comparable-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Observaciones</label>
                  <textarea id="comparable-notes" name="notes" rows={2} placeholder="Detalles adicionales..." className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500" />
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
        className={`${styles.modal} fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm`}
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
              aria-label="Cerrar detalle de comparable"
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
              aria-label="Cerrar detalle de comparable"
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

  return <section className={styles.panel}>
    <div className={styles.sectionHead}><span className={styles.icon}><ChartLineUp size={28} weight="duotone" aria-hidden="true" /></span><div><span className={styles.eyebrow}>REFERENCIAS Y ESTIMACIÓN</span><h3>Tasación y comparables</h3></div></div>
    <p>Agregá referencias externas para preparar una estimación orientativa.</p>
    <div className={styles.toolbar}>
      {canManage && <AppButton className={styles.primary} onClick={() => setShowForm(true)}><PlusCircle size={18} weight="duotone" aria-hidden="true" />Nuevo comparable<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton>}
      {useAi && <TasarButton propertyId={propertyId} />}
    </div>
    <p className={styles.note}><strong>Estimación orientativa, no tasación oficial ni certificada.</strong> Requiere revisión profesional. Las referencias se cargan manualmente; el sistema no verifica que los avisos continúen vigentes. El resultado depende de la calidad y actualidad de los comparables.</p>
    {comparables.length ? <div className={styles.tableWrap}><table className={styles.comparables}><caption className="sr-only">Comparables externos registrados</caption><thead><tr><th scope="col">Referencia</th><th scope="col">Precio</th><th scope="col">Características</th><th scope="col">Acciones</th></tr></thead><tbody>{comparables.map(comp => <tr key={comp.id}>
      <td><strong>{comp.source_name || 'Manual'}</strong><span>{comp.address || comp.neighborhood || comp.city || 'Sin dirección'}</span><small>Ref. {comp.reference_date || 'Sin fecha'}</small></td>
      <td><strong>{comp.currency} {comp.price.toLocaleString('es-AR')}</strong><small>Comparable externo</small></td>
      <td>{comp.surface_total_m2 != null ? `${comp.surface_total_m2} m² totales` : 'Sin superficie'}<small>{comp.rooms != null ? `${comp.rooms} ambientes` : 'Sin ambientes'}</small></td>
      <td><div className={styles.tableActions}><AppButton className={styles.primary} onClick={() => setSelectedComp(comp)}>Ver detalle<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButton>{canManage && <AppButton variant="destructive" aria-label={`Eliminar comparable ${comp.source_name || comp.id}`} onClick={async () => { if (confirm('¿Eliminar este comparable?')) await eliminarComparable(comp.id, propertyId); }}><Trash2 size={18} aria-hidden="true" /></AppButton>}</div></td>
    </tr>)}</tbody></table></div> : <div className={styles.note}><Search size={22} aria-hidden="true" /><p>No hay comparables externos registrados.</p><p>La tasación IA usará propiedades similares del sistema como testigos internos si están disponibles.</p></div>}
    {renderFormModal()}{renderDetailModal()}
  </section>;
}
