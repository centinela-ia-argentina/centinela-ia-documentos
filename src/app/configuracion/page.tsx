import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock, Building2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { updateOrganizationIndustryType, updateOrganizationName, updateOrganizationLogo } from './actions';
import {
  ACTIVE_INDUSTRY_TYPES,
  industryLabels,
  normalizeIndustryType,
} from '@/lib/industries/documentTypes';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';

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
  logo_update_failed: 'No se pudo guardar el nuevo logo en la base de datos.',
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
  const { data: org } = await supabase
    .from('organizations')
    .select('name, industry_type, logo_url')
    .eq('id', profile.organization_id)
    .single();

  const currentIndustry = normalizeIndustryType(org?.industry_type);
  const isUnset = currentIndustry === 'general';

  const statusMsg = getStatusMessage(params.success, params.error);

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft">
          AJUSTES GLOBALES
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          Panel de <span className="text-gradient">Ajustes</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Administrá la identidad del espacio y la seguridad de tu cuenta.
        </p>
        {statusMsg && (
          <div
            className={`mt-4 max-w-3xl rounded-xl border px-4 py-3 text-sm ${
              statusMsg.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </div>

      <div className="max-w-3xl space-y-6">
        <MotionCard index={0} className="border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_40px_-16px_rgba(0,0,0,0.7)] transition-colors hover:border-accent/40">
          <div className="mb-6">
            <h3 className="font-display text-xl font-semibold text-white">Identidad del espacio</h3>
            <p className="mt-2 text-sm text-slate-400">
              Configuración de la identidad visual y datos básicos de tu organización.
            </p>
          </div>

          <div className="mb-8 flex items-center gap-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] border border-white/10">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 size={24} className="text-slate-400" />
              )}
            </div>
            <form action={updateOrganizationLogo} className="flex flex-1 flex-col sm:flex-row items-end gap-4">
              <input type="hidden" name="organization_id" value={profile.organization_id} />
              <div className="flex-1 space-y-2 w-full">
                <label className="text-sm text-slate-400 block">Logo de la organización</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    id="logo-input"
                    name="logo"
                    accept="image/*"
                    className="sr-only"
                  />
                  <label
                    htmlFor="logo-input"
                    className="cursor-pointer rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 text-center block"
                  >
                    Seleccionar imagen
                  </label>
                </div>
              </div>
              <MotionButton
                type="submit"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20"
              >
                Subir logo
              </MotionButton>
            </form>
          </div>

          <form action={updateOrganizationName} className="mb-8 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <input type="hidden" name="organization_id" value={profile.organization_id} />
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Nombre del estudio / organización</label>
              <input
                type="text"
                name="name"
                defaultValue={org?.name ?? ''}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <MotionButton
              type="submit"
              className="w-full bg-accent hover:bg-accent-strong"
            >
              Guardar nombre
            </MotionButton>
          </form>

          <div className="mb-4">
            <h4 className="font-semibold text-white">Rubro de la organización</h4>
            <p className="text-sm text-slate-400">
              {isUnset
                ? "Elegí el rubro de tu organización. Esta acción se realiza una sola vez para estructurar el sistema."
                : "El rubro define la estructura de legajos y documentos del espacio de trabajo."}
            </p>
          </div>

          {isUnset ? (
            <form action={updateOrganizationIndustryType} className="space-y-4">
              <input type="hidden" name="organization_id" value={profile.organization_id} />
              <div className="mb-2">
                <label className="text-sm text-slate-400">
                  Rubro actual: <span className="font-semibold text-white">{industryLabels[currentIndustry]}</span>
                </label>
              </div>

              <select
                name="industry_type"
                defaultValue={currentIndustry}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              >
                {ACTIVE_INDUSTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {industryLabels[t]}
                  </option>
                ))}
              </select>
              <MotionButton
                type="submit"
                className="w-full bg-accent hover:bg-accent-strong"
              >
                Guardar rubro
              </MotionButton>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
                <label className="text-sm text-slate-400 block mb-1">Rubro actual:</label>
                <span className="font-semibold text-white text-lg">{industryLabels[currentIndustry]}</span>
              </div>
              <p className="text-xs text-slate-500">
                El rubro se definió al crear el espacio y determina sus herramientas y flujos.
              </p>
            </div>
          )}
        </MotionCard>

        <Link href="/configuracion/seguridad-cuenta" className="block">
          <MotionCard index={1} className="group flex flex-col justify-between border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_40px_-16px_rgba(0,0,0,0.7)] transition-colors hover:border-accent/40">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-white group-hover:text-accent transition-colors">Seguridad de la cuenta</h3>
                <p className="mt-1 text-sm text-slate-400">Protegé tu acceso con verificación en dos pasos (2FA).</p>
              </div>
            </div>
          </MotionCard>
        </Link>
      </div>
    </AppShell>
  );
}
