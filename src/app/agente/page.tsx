import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { canUseAi, isReadOnlyRole } from '@/lib/permissions/roles';
import { AgenteGlobalChat } from './AgenteGlobalChat';

type Alerta = {
  fecha: string;
  dias: number;
  titulo: string;
  contexto: string;
  tipo: string;
  href: string;
};

function diasDesdeHoy(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(y, m - 1, d);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
}

function textoDias(n: number): string {
  if (n < 0) return `hace ${Math.abs(n)} día${Math.abs(n) === 1 ? '' : 's'}`;
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const NIVELES = {
  vencido: { chip: 'bg-rose-500/10 text-rose-300 border-rose-400/20', dot: 'bg-rose-400', borde: 'border-l-rose-500' },
  urgente: { chip: 'bg-amber-500/10 text-amber-300 border-amber-400/20', dot: 'bg-amber-400', borde: 'border-l-amber-500' },
  proximo: { chip: 'bg-yellow-500/10 text-yellow-200 border-yellow-300/20', dot: 'bg-yellow-300', borde: 'border-l-yellow-400' },
  agenda: { chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20', dot: 'bg-emerald-400', borde: 'border-l-emerald-500' },
} as const;

function nivelDe(n: number): keyof typeof NIVELES {
  if (n < 0) return 'vencido';
  if (n <= 7) return 'urgente';
  if (n <= 15) return 'proximo';
  return 'agenda';
}

export default async function AgentePage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (isReadOnlyRole(profile.role as any)) redirect('/acceso-denegado?motivo=rol');

  const supabase = await createClient();

  const [documentsResult, casesResult, plazosResult, orgResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, file_name, expires_at, case_id')
      .eq('organization_id', profile.organization_id)
      .not('expires_at', 'is', null),
    supabase
      .from('cases')
      .select('id, title, status')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),
    supabase
      .from('agenda_plazos')
      .select('titulo, fecha, case_id, categoria')
      .eq('organization_id', profile.organization_id),
    supabase
      .from('organizations')
      .select('industry_type')
      .eq('id', profile.organization_id)
      .maybeSingle(),
  ]);

  const documents = documentsResult.data ?? [];
  const cases = casesResult.data ?? [];
  const plazos = plazosResult.data ?? [];

  const industry = normalizeIndustryType(orgResult.data?.industry_type);
  const puedeUsarIA = canUseAi(profile.role);

  const caseTitleById = new Map<string, string>();
  for (const c of cases) caseTitleById.set(c.id, c.title || 'Expediente sin título');

  const alertas: Alerta[] = [];

  for (const d of documents) {
    if (!d.expires_at) continue;
    const fecha = String(d.expires_at).slice(0, 10);
    const dias = diasDesdeHoy(fecha);
    if (Number.isNaN(dias) || dias < -90 || dias > 30) continue;
    alertas.push({
      fecha,
      dias,
      titulo: `Vence documento: ${d.file_name}`,
      contexto: d.case_id ? caseTitleById.get(d.case_id) ?? 'Documento' : 'Documento',
      tipo: 'Documento',
      href: `/documentos/${d.id}`,
    });
  }

  const firmasVistas = new Set<string>();

  for (const p of plazos) {
    if (!p.fecha) continue;
    const cid = (p as any).case_id ?? null;
    const categoria = (p as any).categoria ?? '__sin_categoria__';
    const tituloString = p.titulo ?? 'Plazo';
    const tituloNorm = tituloString.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
    const fechaNorm = String(p.fecha).slice(0, 10);
    const firma = `${cid || ''}|${fechaNorm}|${categoria}|${tituloNorm}`;

    if (firmasVistas.has(firma)) continue;
    firmasVistas.add(firma);

    const fecha = fechaNorm;
    const dias = diasDesdeHoy(fecha);
    if (Number.isNaN(dias) || dias < -90 || dias > 30) continue;
    alertas.push({
      fecha,
      dias,
      titulo: tituloString,
      contexto: p.case_id ? caseTitleById.get(p.case_id) ?? 'Agenda' : 'Agenda',
      tipo: p.case_id ? caseTitleById.get(p.case_id) ?? 'Agenda' : 'Agenda',
      href: p.case_id ? `/expedientes/${p.case_id}` : '/agenda',
    });
  }

  alertas.sort((a, b) => {
    if (a.dias !== b.dias) return a.dias - b.dias;
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
    return a.titulo.localeCompare(b.titulo);
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <AgenteGlobalChat industry={industry} puedeUsarIA={puedeUsarIA} />

        <section className="rounded-[26px] border border-white/10 bg-[#081A22] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)] sm:p-7">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-medium tracking-[-0.035em] text-[#F3F8F5]">Alertas tempranas</h2>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-ui text-xs font-semibold text-[#B8C6C1]">
              {alertas.length}
            </span>
          </div>
          <p className="mt-2 max-w-3xl font-ui text-sm leading-6 text-[#8FA19B]">
            Vencimientos y plazos de toda la organización (vencidos recientes y próximos 30 días).
            Preguntale al agente <span className="font-semibold text-[#85E4D4]">&quot;¿qué hago con estas alertas?&quot;</span> y te ayuda a entenderlas y priorizarlas.
          </p>

          {alertas.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-6 text-center font-ui text-sm text-emerald-300">
              Todo tranquilo: no hay vencimientos ni plazos próximos.
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {alertas.map((a, i) => {
                const nivel = NIVELES[nivelDe(a.dias)];
                return (
                  <li key={i}>
                    <Link
                      href={a.href}
                      className={`flex items-center gap-3 border-l-2 ${nivel.borde} px-3 py-3 transition-colors hover:bg-white/[0.035]`}
                    >
                      <span className={`inline-flex min-w-24 items-center gap-2 rounded-md border px-2 py-1 font-ui text-xs font-semibold ${nivel.chip}`}>
                        <span className={`h-1.5 w-1.5 rotate-45 ${nivel.dot}`} />
                        {textoDias(a.dias)}
                      </span>
                      <span className="font-ui text-xs text-[#71857F]">{formatFecha(a.fecha)}</span>
                      <span className="min-w-0 flex-1 truncate font-ui text-sm text-[#DCE7E3]">
                        {a.titulo}
                      </span>
                      <span className="hidden shrink-0 font-ui text-xs text-[#71857F] sm:block">
                        {a.tipo}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
