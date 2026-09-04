import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { isCaseTypeCompatibleWithIndustry } from '@/lib/industries/caseConfig';
import { getAgendaLabels } from '@/lib/industries/uiLabels';
import { AgendaClient, type AgendaEvento } from './AgendaClient';

export interface AgendaDocumentRecord {
  id: string;
  file_name?: string | null;
  expires_at: string | Date | null;
  case_id?: string | null;
}

export function filterAgendaDocuments(
  documents: AgendaDocumentRecord[],
  compatibleCaseIds: Set<string>
): AgendaEvento[] {
  const eventos: AgendaEvento[] = [];
  for (const doc of documents) {
    if (!doc.expires_at) continue;
    // Si el documento está asociado a un caso, solo incluir si el caso es compatible con la vertical activa
    if (doc.case_id && !compatibleCaseIds.has(doc.case_id)) continue;
    // Documentos sin case_id (a nivel organización) se incluyen si pertenecen a profile.organization_id (garantizado por el query)
    eventos.push({
      id: `doc-${doc.id}`,
      fecha: String(doc.expires_at).slice(0, 10),
      titulo: doc.file_name ?? 'Documento',
      tipo: 'documento',
      href: `/documentos/${doc.id}`,
    });
  }
  return eventos;
}

export default async function AgendaPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const [industry, documentsResult, casesResult, plazosResult] = await Promise.all([
    getStrictIndustryForOrganization(profile.organization_id),
    supabase
      .from('documents')
      .select('id, file_name, expires_at, case_id')
      .eq('organization_id', profile.organization_id)
      .not('expires_at', 'is', null),
    supabase
      .from('cases')
      .select('id, title, metadata, case_type')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),
    supabase
      .from('agenda_plazos')
      .select('id, titulo, fecha, hora, detalle, categoria, case_id')
      .eq('organization_id', profile.organization_id),
  ]);

  const agendaLabels = getAgendaLabels(industry);

  const documents = documentsResult.data ?? [];
  const allCases = casesResult.data ?? [];
  const plazos = plazosResult.data ?? [];

  // Filtrado estricto por industria para evitar contaminación entre verticales
  const cases = allCases.filter((c) => isCaseTypeCompatibleWithIndustry(c.case_type, industry));
  const compatibleCaseIds = new Set(cases.map((c) => c.id));

  const caseTitleById = new Map<string, string>();
  for (const c of cases) caseTitleById.set(c.id, c.title || 'Expediente sin título');

  const eventos: AgendaEvento[] = [
    ...filterAgendaDocuments(documents, compatibleCaseIds),
  ];

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
