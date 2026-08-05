import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getAgendaLabels } from '@/lib/industries/uiLabels';
import { AgendaClient, type AgendaEvento } from './AgendaClient';

export default async function AgendaPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const [documentsResult, casesResult, plazosResult, orgResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, file_name, expires_at')
      .eq('organization_id', profile.organization_id)
      .not('expires_at', 'is', null),
    supabase
      .from('cases')
      .select('id, title, metadata')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),
    supabase
      .from('agenda_plazos')
      .select('id, titulo, fecha, hora, detalle, categoria, case_id')
      .eq('organization_id', profile.organization_id),
    supabase
      .from('organizations')
      .select('industry_type')
      .eq('id', profile.organization_id)
      .single(),
  ]);

  const industry = normalizeIndustryType(orgResult.data?.industry_type);
  const agendaLabels = getAgendaLabels(industry);

  const documents = documentsResult.data ?? [];
  const cases = casesResult.data ?? [];
  const plazos = plazosResult.data ?? [];

  const eventos: AgendaEvento[] = [];

  const caseTitleById = new Map<string, string>();
  for (const c of cases) caseTitleById.set(c.id, c.title || 'Expediente sin título');

  for (const doc of documents) {
    if (!doc.expires_at) continue;
    eventos.push({
      id: `doc-${doc.id}`,
      fecha: String(doc.expires_at).slice(0, 10),
      titulo: doc.file_name ?? 'Documento',
      tipo: 'documento',
      href: `/documentos/${doc.id}`,
    });
  }

  for (const c of cases) {
    const fecha = ((c.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined)?.trim();
    if (!fecha) continue;
    eventos.push({
      id: `case-${c.id}`,
      fecha: fecha.slice(0, 10),
      titulo: c.title || 'Expediente sin título',
      tipo: 'expediente',
      href: `/expedientes/${c.id}`,
    });
  }

  const firmasVistas = new Set<string>();

  for (const p of plazos) {
    if (!p.fecha) continue;
    const categoria = (p as { categoria?: string }).categoria ?? '__sin_categoria__';
    const cid = (p as { case_id?: string | null }).case_id ?? null;
    const hora = (p as { hora?: string | null }).hora ?? null;
    const tipo =
      categoria === 'manual' ? 'evento'
      : categoria === 'turno' ? 'turno'
      : categoria === 'firma' ? 'firma'
      : 'plazo';
    const tituloString = p.titulo ?? (tipo === 'evento' ? 'Evento' : tipo === 'turno' ? 'Turno' : tipo === 'firma' ? 'Firma' : agendaLabels.plazoLabel);

    const tituloNorm = tituloString.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
    const fechaNorm = String(p.fecha).slice(0, 10);
    const firma = `${cid || ''}|${fechaNorm}|${categoria}|${tituloNorm}`;
    
    if (firmasVistas.has(firma)) continue;
    firmasVistas.add(firma);

    eventos.push({
      id: `${tipo}-${p.id}`,
      fecha: fechaNorm,
      hora: hora ?? undefined,
      titulo: tituloString,
      tipo,
      href: cid ? `/expedientes/${cid}` : '/agenda',
      expedienteNombre: cid ? caseTitleById.get(cid) : undefined,
    });
  }

  const puedeGuardar = profile.role === 'admin' || profile.role === 'employee';

  return (
    <AppShell>
      <AgendaClient industry={industry} eventos={eventos} cases={cases.map((c) => ({ id: c.id, title: c.title || 'Expediente sin título' }))} puedeGuardar={puedeGuardar} />
    </AppShell>
  );
}
