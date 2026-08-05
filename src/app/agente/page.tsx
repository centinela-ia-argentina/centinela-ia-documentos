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
  vencido: { chip: 'bg-rose-500/20 text-rose-300', dot: '🔴', borde: 'border-l-rose-500' },
  urgente: { chip: 'bg-amber-500/20 text-amber-300', dot: '🟠', borde: 'border-l-amber-500' },
  proximo: { chip: 'bg-yellow-500/20 text-yellow-300', dot: '🟡', borde: 'border-l-yellow-500' },
  agenda: { chip: 'bg-emerald-500/20 text-emerald-300', dot: '🟢', borde: 'border-l-emerald-500' },
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
    const categoria = (p as any).categoria ?? 'plazo';
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

  alertas.sort((a, b) => a.dias - b.dias);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <AgenteGlobalChat industry={industry} puedeUsarIA={puedeUsarIA} />

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">🚦 Alertas tempranas</h3>
            <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-300">
              {alertas.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Vencimientos y plazos de toda la organización (vencidos recientes y próximos 30 días).
            Preguntale al agente <span className="text-cyan-300">"¿qué hago con estas alertas?"</span> y te ayuda a entenderlas y priorizarlas.
          </p>

          {alertas.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-6 text-center text-sm text-emerald-300">
              ✅ Todo tranquilo: no hay vencimientos ni plazos próximos.
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {alertas.map((a, i) => {
                const nivel = NIVELES[nivelDe(a.dias)];
                return (
                  <li key={i}>
                    <Link
                      href={a.href}
                      className={`flex items-center gap-3 rounded-lg border border-slate-800 border-l-4 ${nivel.borde} bg-slate-950/40 px-3 py-2.5 transition hover:bg-slate-800/40`}
                    >
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${nivel.chip}`}>
                        {nivel.dot} {textoDias(a.dias)}
                      </span>
                      <span className="text-xs text-slate-500">{formatFecha(a.fecha)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {a.titulo}
                      </span>
                      <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
                        {a.tipo}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
