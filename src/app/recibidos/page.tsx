import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { aceptarDerivacion, rechazarDerivacion } from './actions';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';

export default async function RecibidosPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const organizationIndustry = orgData?.industry_type || 'general';
  const terms = getIndustryTerms(organizationIndustry as any);

  const { data } = await supabase
    .from('case_derivations')
    .select('id, case_id, from_organization_name, case_title, to_email, status, mensaje, created_at, to_organization_id')
    .order('created_at', { ascending: false });
    
  const derivaciones = data ?? [];
  const pendientes = derivaciones.filter(d => d.status === 'pendiente');
  const aceptadas  = derivaciones.filter(d => d.status === 'aceptada');
  const historicas = derivaciones.filter(d => d.status === 'rechazada' || d.status === 'revocada');

  const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-400">Recibidos</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{terms.expedientePlural} derivados</h1>
          <p className="mt-1 text-sm text-slate-400">
            Administrá los {terms.expedientePlural.toLowerCase()} y documentos que otras organizaciones te derivaron.
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold text-white">Pendientes ({pendientes.length})</h2>
          {pendientes.length === 0 ? (
            <p className="text-sm text-slate-500">No tenés derivaciones pendientes.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendientes.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-medium text-white">{d.case_title || terms.itemSinTitulo}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                  </p>
                  {d.mensaje && (
                    <p className="mt-3 text-sm text-slate-300">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-5 flex items-center gap-2">
                    <form action={aceptarDerivacion}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90">
                        Aceptar
                      </button>
                    </form>
                    <form action={rechazarDerivacion}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10">
                        Rechazar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-base font-semibold text-white">Aceptadas ({aceptadas.length})</h2>
          {aceptadas.length === 0 ? (
            <p className="text-sm text-slate-500">No tenés derivaciones aceptadas.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aceptadas.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-medium text-white">{d.case_title || 'Legajo sin título'}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                  </p>
                  {d.mensaje && (
                    <p className="mt-3 text-sm text-slate-300">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-5">
                    <Link
                      href={`/recibidos/${d.id}`}
                      className="inline-flex rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Ver {terms.expedienteSingular.toLowerCase()} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {historicas.length > 0 && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-white">Historial ({historicas.length})</h2>
            <div className="space-y-2">
              {historicas.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{d.case_title || 'Legajo sin título'}</p>
                    <p className="text-xs text-slate-500">
                      De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                    </p>
                  </div>
                  <div>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-xs font-medium text-slate-400 capitalize">
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
