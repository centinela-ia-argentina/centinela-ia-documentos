'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearComparable, eliminarComparable } from '../actions';
import { Badge } from '@/components/ui/Badge';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import type { ComparableRecord } from '@/types/comparable';
import { TasarButton } from './TasarButton';

interface TasacionPanelProps {
  propertyId: string;
  propertyType: string;
  comparables: ComparableRecord[];
}

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}

export function TasacionPanel({ propertyId, propertyType, comparables }: TasacionPanelProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            📊 Tasación y Comparables (Testigo)
          </h3>
          <p className="mt-1 text-xs text-slate-500">Agregá comparables externos para usar en la tasación de la IA.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo comparable
          </button>
          <TasarButton propertyId={propertyId} />
        </div>
      </div>

      {showForm && (
        <form 
          action={async (formData) => {
            const res = await crearComparable(formData);
            if (res.ok) {
              setShowForm(false);
            } else {
              alert(res.error || 'Error al guardar');
            }
          }}
          className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4"
        >
          <input type="hidden" name="property_id" value={propertyId} />
          <input type="hidden" name="property_type" value={propertyType} />

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Origen / Portal</label>
              <input name="source_name" type="text" placeholder="Ej. Zonaprop" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">URL (Opcional)</label>
              <input name="source_url" type="url" placeholder="https://" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dirección / Zona</label>
              <input name="address" type="text" required placeholder="Ej. Libertador 1234" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Moneda</label>
              <select name="currency" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500">
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio</label>
              <input name="price" type="number" required placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sup. Total (m²)</label>
              <input name="surface_total_m2" type="number" step="0.01" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ambientes</label>
              <input name="rooms" type="number" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-white"
            >
              Cancelar
            </button>
            <SubmitButton label="Guardar" loadingLabel="Guardando..." />
          </div>
        </form>
      )}

      {comparables.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-white/[0.02] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Origen</th>
                <th className="px-4 py-3 font-semibold">Dirección</th>
                <th className="px-4 py-3 font-semibold">Superficie</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {comparables.map((comp) => (
                <tr key={comp.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-white">
                    {comp.source_name || 'Manual'}
                    {comp.source_url && (
                      <a href={comp.source_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-block text-cyan-400 hover:text-cyan-300">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">{comp.address || '-'}</td>
                  <td className="px-4 py-3">{comp.surface_total_m2 ? `${comp.surface_total_m2} m²` : '-'}</td>
                  <td className="px-4 py-3 font-bold text-white">
                    {comp.currency} {comp.price.toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        if (confirm('¿Eliminar este comparable?')) {
                          await eliminarComparable(comp.id, propertyId);
                        }
                      }}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center border border-dashed border-white/10 rounded-xl p-4">
          No hay comparables externos registrados. La tasación IA usará propiedades similares del sistema.
        </p>
      )}
    </div>
  );
}
