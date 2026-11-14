import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock, Building2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { isPlatformOwner } from '@/lib/permissions/platformOwner';
import { updateOrganizationIndustryType, updateOrganizationName, updateOrganizationLogo } from './actions';
import {
  industryLabels,
  normalizeIndustryType,
} from '@/lib/industries/documentTypes';
import { MotionCard } from '@/components/ui/MotionCard';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

interface ConfiguracionPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

const successMessages: Record<string, string> = {
  name_updated: 'Nombre actualizado correctamente.',
  logo_updated: 'Logo actualizado correctamente.',
  industry_updated: 'Rubro definido correctamente.',
};

const errorMessages: Record<string, string> = {
  name_invalid: 'Revisá el nombre ingresado.',
  name_locked: 'No tenés permisos para modificar el nombre de la organización.',
  name_update_failed: 'No se pudo guardar el nuevo nombre.',
  logo_invalid: 'Revisá el archivo seleccionado (formato y peso permitidos).',
  logo_locked: 'No tenés permisos para modificar el logo de la organización.',
  logo_upload_failed: 'No se pudo subir el archivo de logo al storage.',
  logo_update_failed:
    'El archivo se subió pero no se pudo asociar el logo. El logo anterior puede seguir activo: revisá el estado actual antes de reintentar.',
  industry_invalid: 'El rubro seleccionado no es válido.',
  industry_locked: 'El rubro ya fue definido y no puede modificarse.',
  industry_update_failed: 'No se pudo asignar el rubro seleccionado.',
  platform_unavailable: 'Servicio temporalmente no disponible. Intentá más tarde.',
};

function getStatusMessage(success?: string, error?: string) {
  if (success && success in successMessages) {
    return { text: successMessages[success], type: 'success' as const };
  }
  if (error && error in errorMessages) {
    return { text: errorMessages[error], type: 'error' as const };
  }
  if (error) {
    return { text: 'Ocurrió un error al intentar guardar los cambios.', type: 'error' as const };
  }
  return null;
}

export default async function ConfiguracionPage({ searchParams }: ConfiguracionPageProps) {
  const params = await searchParams;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  if (profile.role !== 'admin') {
    redirect('/acceso-denegado');
  }

  const supabase = await createClient();
  const orgResult = await supabase
    .from('organizations')
    .select('name, industry_type, logo_url')
    .eq('id', profile.organization_id)
    .single();

  const orgUnavailable = Boolean(orgResult.error);

  const platformOwner = await isPlatformOwner(user.id);
  const currentIndustry = normalizeIndustryType(orgResult.data?.industry_type);
  const isUnset = !orgUnavailable && currentIndustry === 'general';

  const statusMsg = getStatusMessage(params.success, params.error);

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#50565d]">
          Ajustes globales
        </p>
        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#25272a]">
          Panel de ajustes
        </h2>
        <p className="mt-1 text-[13.5px] text-[#6b7075]">
          Administrá la identidad del espacio y la seguridad de tu cuenta.
        </p>
        {statusMsg && (
          <div
            className={`mt-4 max-w-3xl rounded-xl border px-4 py-3 text-sm ${
              statusMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </div>

      {orgUnavailable ? (
        <div className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se pudieron consultar los datos de la organización. Los formularios permanecen deshabilitados hasta confirmar el estado real; no se presentan valores por defecto.
        </div>
      ) : (
      <div className="max-w-3xl space-y-6">
        <MotionCard index={0} className="rounded-xl border border-[#e3e4e5] bg-white p-6 transition-colors hover:border-[#cfd3d2]">
          <div className="mb-6">
            <h3 className="text-[15.5px] font-bold text-[#25272a]">Identidad del espacio</h3>
            <p className="mt-1 text-[13px] text-[#6b7075]">
              Configuración de la identidad visual y datos básicos de tu organización.
            </p>
          </div>

          <div className="mb-8 flex items-start gap-5 p-1">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#cfd3d2] bg-[#fcfcfc]">
              {orgResult.data?.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={orgResult.data?.logo_url ?? ''} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 size={22} className="text-[#6b7075]" />
              )}
            </div>
            <form action={updateOrganizationLogo} className="flex flex-1 flex-col sm:flex-row items-end gap-4">
              <input type="hidden" name="organization_id" value={profile.organization_id} />
              <div className="flex-1 space-y-2 w-full">
                <label className="block text-[11.5px] font-bold text-[#50565d]">Logo de la organización</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    id="logo-input"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                  />
                  <label
                    htmlFor="logo-input"
                    className="cursor-pointer rounded-lg border border-[#e3e4e5] bg-white px-3.5 py-2 text-[12px] font-bold text-[#25272a] transition-colors hover:bg-[#f3f4f4] text-center block"
                  >
                    Seleccionar imagen
                  </label>
                  <span className="text-[11.5px] text-[#6b7075]">PNG, JPG, WebP o SVG · hasta 2 MB. Vista previa al elegir el archivo.</span>
                </div>
              </div>
              <FormSubmitButton
                label="Subir logo"
                loadingLabel="Subiendo…"
                className="w-full sm:w-auto rounded-lg bg-[#25272a] px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3d41] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </form>
          </div>

          <div className="my-6 border-t border-[#eceeed]" />
          <form action={updateOrganizationName} className="mb-8 space-y-2">
            <input type="hidden" name="organization_id" value={profile.organization_id} />
            <div className="space-y-1">
              <label className="block text-[11.5px] font-bold text-[#50565d]">Nombre del estudio / organización</label>
              <input
                type="text"
                name="name"
                defaultValue={orgResult.data?.name ?? ''}
                className="w-full rounded-lg border border-[#e3e4e5] bg-white px-3.5 py-2.5 text-[13.5px] text-[#25272a] outline-none focus:border-[#25272a] focus:ring-1 focus:ring-[#25272a]/20"
              />
              <p className="text-[11.5px] text-[#6b7075]">Se muestra en la sidebar y en los documentos generados.</p>
            </div>
            <FormSubmitButton
              label="Guardar nombre"
              loadingLabel="Guardando…"
              className="w-full rounded-lg bg-[#25272a] px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-[#3a3d41] disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </form>

          <div className="mb-4">
            <h4 className="text-[15.5px] font-bold text-[#25272a]">Rubro de la organización</h4>
            <p className="mt-1 text-[13px] text-[#6b7075]">
              {isUnset
                ? "Elegí el rubro de tu organización. Esta acción se realiza una sola vez para estructurar el sistema."
                : "El rubro define la estructura de legajos y documentos del espacio de trabajo."}
            </p>
          </div>

          {(isUnset || platformOwner) ? (
            <form action={updateOrganizationIndustryType} className="space-y-4">
              <input type="hidden" name="organization_id" value={profile.organization_id} />
              <div className="mb-3">
                <label className="text-[12.5px] text-[#6b7075]">
                  Rubro actual: <span className="font-bold text-[#25272a]">{industryLabels[currentIndustry]}</span>
                </label>
              </div>

              {isUnset ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-800">
                  Elegí con cuidado: el rubro define tus herramientas y flujos y no se puede cambiar después.
                </p>
              ) : null}

              {(!isUnset && platformOwner) ? (
                <p className="rounded-lg border border-sky-200 bg-sky-50 p-3.5 text-xs font-semibold text-sky-800">
                  Como administrador de plataforma, podés cambiar el rubro activo de este espacio.
                </p>
              ) : null}

              <select
                name="industry_type"
                required
                defaultValue=""
                className="w-full rounded-lg border border-[#e3e4e5] bg-white px-3.5 py-2.5 pr-10 text-[13.5px] text-[#25272a] outline-none focus:border-[#25272a] focus:ring-1 focus:ring-[#25272a]/20"
              >
                <option value="" disabled>
                  — Sin selección (definir explícitamente) —
                </option>
                {(['legal', 'escribania', 'inmobiliaria'] as const).map((t) => (
                  <option key={t} value={t}>
                    {industryLabels[t]}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] text-[#6b7075]">El cambio afecta solo la estructura operativa. No modifica datos existentes.</p>
              <FormSubmitButton
                label="Guardar rubro"
                loadingLabel="Guardando…"
                className="w-full rounded-lg bg-[#25272a] px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-[#3a3d41] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#eceeed] bg-[#fcfcfc] px-4 py-4">
                <label className="block text-[11.5px] font-bold text-[#50565d]">Rubro actual</label>
                <span className="text-lg font-bold text-[#25272a]">{industryLabels[currentIndustry]}</span>
              </div>
              <p className="text-[11.5px] text-[#6b7075]">
                El rubro se definió al crear el espacio y determina sus herramientas y flujos.
              </p>
            </div>
          )}
        </MotionCard>

        <Link href="/configuracion/seguridad-cuenta" className="block">
          <MotionCard index={1} className="group flex flex-col justify-between rounded-xl border border-[#e3e4e5] bg-white p-6 transition-colors hover:border-[#cfd3d2]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#eceeed] bg-[#fcfcfc] text-[#50565d]">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#25272a] group-hover:underline">Seguridad de la cuenta</h3>
                <p className="mt-1 text-[13px] text-[#6b7075]">Protegé tu acceso con verificación en dos pasos (2FA).</p>
              </div>
            </div>
          </MotionCard>
        </Link>
      </div>
      )}
    </AppShell>
  );
}
