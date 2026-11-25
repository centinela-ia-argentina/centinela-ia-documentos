import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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

  // Solo derivaciones dirigidas a mi organización (o a mi email directo): RLS también
  // expone las enviadas por mi org (from_organization_id) y esas no son "recibidas".
  const myEmail = user.email?.toLowerCase() ?? '';
  const derivationsFilter = myEmail
    ? `to_organization_id.eq.${profile.organization_id},to_email.eq.${myEmail}`
    : `to_organization_id.eq.${profile.organization_id}`;

  const { data } = await supabase
    .from('case_derivations')
    .select('id, case_id, from_organization_name, case_title, to_email, status, mensaje, created_at, to_organization_id')
    .or(derivationsFilter)
    .order('created_at', { ascending: false });

  const derivaciones = data ?? [];
  const pendientes = derivaciones.filter(d => d.status === 'pendiente');
  const aceptadas  = derivaciones.filter(d => d.status === 'aceptada');
  const historicas = derivaciones.filter(d => d.status === 'rechazada' || d.status === 'revocada');

  const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' });

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1080px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#626b73]">Recibidos</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-.02em] text-[#25272a]">{terms.expedientePlural} derivados</h1>
          <p className="mt-1 text-xs text-[#626b73]">
            Administrá los {terms.expedientePlural.toLowerCase()} y documentos que otras organizaciones derivaron a tu organización.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-[#25272a]">Pendientes ({pendientes.length})</h2>
          {pendientes.length === 0 ? (
            <p className="text-xs text-[#626b73]">No tenés derivaciones pendientes.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendientes.map((d) => (
                <div key={d.id} className="rounded-[10px] border border-[#d9d9d6] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#25272a]">{d.case_title || terms.itemSinTitulo}</h3>
                  <p className="mt-1 text-xs text-[#626b73]">
                    De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                  </p>
                  {d.mensaje && (
                    <p className="mt-3 text-xs leading-relaxed text-[#25272a]">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-5 flex items-center gap-2">
                    <form action={aceptarDerivacion}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="rounded-[6px] bg-[#2c2c2b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#424242]">
                        Aceptar
                      </button>
                    </form>
                    <form action={rechazarDerivacion}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="rounded-[6px] border border-[#92928f] bg-white px-3 py-2 text-xs font-semibold text-[#303030] hover:bg-[#f1f1ef]">
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
          <h2 className="mb-3 text-sm font-semibold text-[#25272a]">Aceptadas ({aceptadas.length})</h2>
          {aceptadas.length === 0 ? (
            <p className="text-xs text-[#626b73]">No tenés derivaciones aceptadas.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aceptadas.map((d) => (
                <div key={d.id} className="rounded-[10px] border border-[#d9d9d6] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#25272a]">{d.case_title || terms.itemSinTitulo}</h3>
                  <p className="mt-1 text-xs text-[#626b73]">
                    De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                  </p>
                  {d.mensaje && (
                    <p className="mt-3 text-xs leading-relaxed text-[#25272a]">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-5">
                    <Link
                      href={`/recibidos/${d.id}`}
                      className="inline-flex items-center gap-2 rounded-[6px] bg-[#2c2c2b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#424242]"
                    >
                      Ver {terms.expedienteSingular.toLowerCase()}<ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {historicas.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[#25272a]">Historial ({historicas.length})</h2>
            <div className="space-y-2">
              {historicas.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-[10px] border border-[#e4e5e3] bg-white p-4">
                  <div>
                    <p className="text-sm font-medium text-[#25272a]">{d.case_title || terms.itemSinTitulo}</p>
                    <p className="text-xs text-[#626b73]">
                      De: {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                    </p>
                  </div>
                  <div>
                    <span className="rounded-full bg-[#f1f1ef] px-2 py-1 text-xs font-medium text-[#626b73] capitalize">
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
