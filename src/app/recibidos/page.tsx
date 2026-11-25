import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowDownLeft } from 'lucide-react';
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

  const estadoTint =
    pendientes.length > 0
      ? { label: 'Pendientes de respuesta', tint: 'border-[#e8d9b8] bg-[#fdfbf5] text-[#8a5a1f]' }
      : aceptadas.length > 0
        ? { label: 'En colaboración', tint: 'border-[#cfe4d8] bg-[#f8fcf9] text-[#1f6b45]' }
        : null;

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1080px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#626b73]">Recibidos</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-.02em] text-[#25272a]">{terms.expedientePlural} derivados</h1>
          <p className="mt-1 text-xs text-[#626b73]">
            Lo que otras organizaciones derivaron a tu organización, en un solo lugar.
          </p>
        </div>

        {estadoTint && (
          <div className={`grid gap-4 sm:grid-cols-2`}>
            <div className={`rounded-[10px] border p-5 ${estadoTint.tint}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[1px]">{estadoTint.label}</span>
                <span className="text-[30px] font-semibold tracking-[-.02em]">{pendientes.length}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed opacity-90">
                Debés aceptar o rechazar estas derivaciones para que el legajo entre a tu escritura.
              </p>
            </div>
            <div className={`rounded-[10px] border p-5 ${aceptadas.length > 0 ? 'border-[#cfe4d8] bg-[#f8fcf9] text-[#1f6b45]' : 'border-[#e4e5e3] bg-[#fafaf9] text-[#626b73]'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[1px]">En colaboración</span>
                <span className="text-[30px] font-semibold tracking-[-.02em]">{aceptadas.length}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed opacity-90">
                Legajos abiertos con otra organización: podés aportar documentos y observaciones.
              </p>
            </div>
          </div>
        )}

        {pendientes.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[#25272a]">Pendientes ({pendientes.length})</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {pendientes.map((d) => (
                <div key={d.id} className="rounded-[10px] border border-[#e8d9b8] bg-[#fdfbf5] p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#fdf3dd] text-[#8a5a1f]">
                      <ArrowDownLeft size={17} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#25272a]">{d.case_title || terms.itemSinTitulo}</h3>
                      <p className="mt-0.5 text-xs text-[#626b73]">
                        {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                      </p>
                    </div>
                  </div>
                  {d.mensaje && (
                    <p className="mt-3 text-xs leading-relaxed text-[#626b73]">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
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
          </div>
        )}

        {aceptadas.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[#25272a]">Aceptadas ({aceptadas.length})</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {aceptadas.map((d) => (
                <div key={d.id} className="rounded-[10px] border border-[#cfe4d8] bg-[#f8fcf9] p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#e7f3ec] text-[#1f6b45]">
                      <ArrowRight size={17} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#25272a]">{d.case_title || terms.itemSinTitulo}</h3>
                      <p className="mt-0.5 text-xs text-[#626b73]">
                        {d.from_organization_name} · {dateFormatter.format(new Date(d.created_at))}
                      </p>
                    </div>
                  </div>
                  {d.mensaje && (
                    <p className="mt-3 text-xs leading-relaxed text-[#626b73]">&quot;{d.mensaje}&quot;</p>
                  )}
                  <div className="mt-4">
                    <Link
                      href={`/recibidos/${d.id}`}
                      className="inline-flex items-center gap-2 rounded-[6px] bg-[#2c2c2b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#424242]"
                    >
                      Abrir {terms.expedienteSingular.toLowerCase()}<ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {derivaciones.length === 0 && (
          <div className="rounded-[10px] border border-[#e4e5e3] bg-[#fafaf9] p-8 text-center">
            <p className="text-sm font-semibold text-[#25272a]">No tenés derivaciones todavía</p>
            <p className="mt-1 text-xs text-[#626b73]">Cuando otra organización derive un {terms.expedienteSingular.toLowerCase()} a tu organización, va a aparecer acá.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
