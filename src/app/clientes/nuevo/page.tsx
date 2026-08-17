import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { createClientRecord } from '../actions';

export default async function NuevoClientePage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!canManageClient(profile.role)) redirect('/clientes');

  const darkOptionStyle = { backgroundColor: '#0C2340', color: '#FFFFFF' };
  const inputStyle = "mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-400";
  const selectStyle = "mt-2 w-full rounded-2xl border border-white/10 bg-[#0C2340] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-400";
  const labelStyle = "text-sm font-semibold text-slate-400";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            NUEVO CLIENTE
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-white">
            Registrar contacto o interesado
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Cargá los datos de contacto y definí qué está buscando.
          </p>
        </div>

        <form action={createClientRecord} className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
            <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
              👤 Contacto
            </h3>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelStyle}>Nombre del interesado *</label>
                <input name="name" required placeholder="Ej: Juan Pérez" className={inputStyle} />
              </div>
              
              <div>
                <label className={labelStyle}>Email</label>
                <input type="email" name="email" placeholder="juan@ejemplo.com" className={inputStyle} />
              </div>
              
              <div>
                <label className={labelStyle}>Teléfono</label>
                <input type="text" name="phone" placeholder="+54 9 11 ..." className={inputStyle} />
              </div>

              <div>
                <label className={labelStyle}>Tipo de cliente</label>
                <select name="client_type" className={selectStyle}>
                  <option value="comprador" style={darkOptionStyle}>Comprador</option>
                  <option value="inquilino" style={darkOptionStyle}>Inquilino</option>
                  <option value="vendedor" style={darkOptionStyle}>Vendedor</option>
                  <option value="propietario" style={darkOptionStyle}>Propietario</option>
                  <option value="otro" style={darkOptionStyle}>Otro</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Estado</label>
                <select name="status" className={selectStyle}>
                  <option value="activo" style={darkOptionStyle}>Activo</option>
                  <option value="en_seguimiento" style={darkOptionStyle}>En seguimiento</option>
                  <option value="cerrado" style={darkOptionStyle}>Cerrado</option>
                  <option value="descartado" style={darkOptionStyle}>Descartado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
            <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
              🔎 Qué busca
            </h3>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className={labelStyle}>Interés</label>
                <select name="operation_interest" className={selectStyle}>
                  <option value="" style={darkOptionStyle}>No especificado</option>
                  <option value="compra" style={darkOptionStyle}>Compra</option>
                  <option value="alquiler" style={darkOptionStyle}>Alquiler</option>
                </select>
              </div>

              <div>
                <label className={labelStyle}>Tipo de propiedad buscada</label>
                <select name="desired_property_type" className={selectStyle}>
                  <option value="" style={darkOptionStyle}>No especificado</option>
                  <option value="casa" style={darkOptionStyle}>Casa</option>
                  <option value="departamento" style={darkOptionStyle}>Departamento</option>
                  <option value="lote" style={darkOptionStyle}>Lote/Terreno</option>
                  <option value="local" style={darkOptionStyle}>Local</option>
                  <option value="oficina" style={darkOptionStyle}>Oficina</option>
                  <option value="cochera" style={darkOptionStyle}>Cochera</option>
                  <option value="cualquiera" style={darkOptionStyle}>Cualquiera</option>
                </select>
              </div>

              <div className="sm:col-span-2 grid gap-6 sm:grid-cols-2">
                <div>
                  <label className={labelStyle}>Provincia buscada</label>
                  <input name="desired_province" placeholder="Ej: Buenos Aires" className={inputStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Localidad / Ciudad buscada</label>
                  <input name="desired_city" placeholder="Ej: CABA" className={inputStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Barrio / Zona buscada</label>
                  <input name="desired_neighborhood" placeholder="Ej: Palermo" className={inputStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Subzona buscada (opcional)</label>
                  <input name="desired_subzone" placeholder="Ej: Palermo Soho" className={inputStyle} />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelStyle}>Presupuesto</label>
                <div className="mt-2 flex gap-3">
                  <select name="currency" className="w-24 rounded-2xl border border-white/10 bg-[#0C2340] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-400">
                    <option value="USD" style={darkOptionStyle}>u$s</option>
                    <option value="ARS" style={darkOptionStyle}>$ (ARS)</option>
                  </select>
                  <input type="number" name="budget_min" placeholder="Desde" className={inputStyle + " !mt-0 flex-1"} />
                  <input type="number" name="budget_max" placeholder="Hasta" className={inputStyle + " !mt-0 flex-1"} />
                </div>
              </div>

              <div>
                <label className={labelStyle}>Ambientes mínimos</label>
                <input type="number" name="min_rooms" placeholder="Ej: 2" className={inputStyle} />
              </div>
              
              <div className="sm:col-span-2">
                <label className={labelStyle}>Observaciones</label>
                <textarea name="notes" rows={3} placeholder="Aclaraciones adicionales sobre la búsqueda..." className={inputStyle}></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <FormSubmitButton label="Guardar cliente" loadingLabel="Guardando..." />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
