import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';
import { createProperty } from '../actions';
import { ArrowLeft, Building2 } from 'lucide-react';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

export default async function NuevaPropiedadPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) {
    redirect('/propiedades');
  }

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          href="/propiedades"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a propiedades
        </Link>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            <Building2 className="h-3 w-3" />
            NUEVA PROPIEDAD
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white">
            Alta de ficha técnica
          </h1>
          <p className="mt-3 text-slate-400">
            Registrá la propiedad con sus datos principales. Podrás actualizar esta información más adelante.
          </p>
        </div>

        <form action={createProperty} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
          <div className="space-y-8">
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Datos principales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Identificación de la propiedad *
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Ej. Depto 2 amb - Av. Corrientes 1234"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Tipo de propiedad
                  </label>
                  <select
                    name="property_type"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="" className="bg-[#0C2340] text-white">Seleccionar...</option>
                    <option value="casa" className="bg-[#0C2340] text-white">Casa</option>
                    <option value="departamento" className="bg-[#0C2340] text-white">Departamento</option>
                    <option value="lote/terreno" className="bg-[#0C2340] text-white">Lote/Terreno</option>
                    <option value="local" className="bg-[#0C2340] text-white">Local</option>
                    <option value="oficina" className="bg-[#0C2340] text-white">Oficina</option>
                    <option value="cochera" className="bg-[#0C2340] text-white">Cochera</option>
                    <option value="otro" className="bg-[#0C2340] text-white">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Estado
                  </label>
                  <select
                    name="status"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="disponible" className="bg-[#0C2340] text-white">Disponible</option>
                    <option value="reservada" className="bg-[#0C2340] text-white">Reservada</option>
                    <option value="vendida" className="bg-[#0C2340] text-white">Vendida</option>
                    <option value="alquilada" className="bg-[#0C2340] text-white">Alquilada</option>
                    <option value="no_disponible" className="bg-[#0C2340] text-white">No disponible</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Ubicación</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Dirección (calle, número, piso, depto)
                  </label>
                  <input
                    name="address"
                    type="text"
                    placeholder="Ej. Av. Libertador 1234, Piso 5 Depto A"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Barrio / Zona
                  </label>
                  <input
                    name="neighborhood"
                    type="text"
                    placeholder="Ej. Palermo"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Subzona (opcional)
                  </label>
                  <input
                    name="subzone"
                    type="text"
                    placeholder="Ej. Palermo Soho"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Localidad / Ciudad
                  </label>
                  <input
                    name="city"
                    type="text"
                    placeholder="Ej. CABA"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Provincia
                  </label>
                  <input
                    name="province"
                    type="text"
                    placeholder="Ej. Buenos Aires"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Datos técnicos y registrales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Matrícula / Nomenclatura catastral
                  </label>
                  <input
                    name="matricula"
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Titular(es)
                  </label>
                  <input
                    name="owners"
                    type="text"
                    placeholder="Nombres de los propietarios"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Superficie total (m²)
                  </label>
                  <input
                    name="surface_total_m2"
                    type="number"
                    step="0.01"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Superficie cubierta (m²)
                  </label>
                  <input
                    name="surface_covered_m2"
                    type="number"
                    step="0.01"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Ambientes
                  </label>
                  <input
                    name="rooms"
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Comercial y legal</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Moneda
                  </label>
                  <select
                    name="currency"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="USD" className="bg-[#0C2340] text-white">USD (Dólares)</option>
                    <option value="ARS" className="bg-[#0C2340] text-white">ARS (Pesos)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Valor
                  </label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Gravámenes / inhibiciones
                  </label>
                  <input
                    name="gravamenes"
                    type="text"
                    placeholder="Hipotecas, embargos, etc."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-400">
                    Observaciones
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Notas internas, estado de llaves, detalles..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                  ></textarea>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 flex justify-end">
            <FormSubmitButton label="Guardar propiedad" loadingLabel="Guardando..." />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
