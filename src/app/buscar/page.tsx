import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { type IndustryType } from '@/lib/industries/documentTypes';
import { canUseAi, isUserRole } from '@/lib/permissions/roles';
import { BuscarClient } from './BuscarClient';
import { BackfillDocs } from './BackfillDocs';
import { MotionCard } from '@/components/ui/MotionCard';

export default async function BuscarPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const puedeUsarIA = isUserRole(profile.role) && canUseAi(profile.role);

  let industry: IndustryType | null = null;
  if (profile.organization_id) {
    try {
      industry = await getStrictIndustryForOrganization(profile.organization_id);
    } catch {
      industry = null;
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <MotionCard index={0} className="mb-6 p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            Búsqueda inteligente
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-neutral-900">Preguntá a tus documentos</h1>
          <p className="mt-2 text-[13px] text-neutral-500">
            Hacé una pregunta en lenguaje natural y la IA responde usando el contenido de los
            documentos analizados de tu organización, citando las fuentes.
          </p>
        </MotionCard>

        {puedeUsarIA ? (
          <>
            <BuscarClient industry={industry} />
            {profile.role === 'admin' && <BackfillDocs />}
          </>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Tu rol no tiene habilitada la búsqueda con IA. Consultá con un administrador.
          </div>
        )}
      </div>
    </AppShell>
  );
}
