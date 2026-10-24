import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import {
  isCaseActive,
} from '@/lib/industries/caseConfig';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { isUserRole } from '@/lib/permissions/roles';
import { DashboardView } from '@/components/dashboard/DashboardView';

interface DashboardDocument {
  id: string;
}

export interface DashboardCase {
  id: string;
  title: string | null;
  client_name: string | null;
  case_type: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

function firstName(fullName?: string | null) {
  return fullName?.trim().split(/\s+/)[0] || 'equipo';
}

export default async function DashboardPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const role = isUserRole(profile.role) ? profile.role : null;
  const supabase = await createClient();

  const [organizationResult, casesResult, documentsResult, aiOutputsResult, memberResult] =
    await Promise.all([
      supabase
        .from('organizations')
        .select('name, industry_type')
        .eq('id', profile.organization_id)
        .maybeSingle(),
      supabase
        .from('cases')
        .select('id, title, client_name, case_type, status, metadata, created_at')
        .eq('organization_id', profile.organization_id)
        .neq('status', 'archived')
        .neq('status', 'Archivado')
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_outputs')
        .select('document_id')
        .eq('organization_id', profile.organization_id)
        .eq('output_type', 'document_analysis'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
    ]);

  const industry = normalizeIndustryType(organizationResult.data?.industry_type);
  const terms = getIndustryTerms(industry);
  const cases = (casesResult.data ?? []) as DashboardCase[];
  const documents = (documentsResult.data ?? []) as DashboardDocument[];
  const aiOutputs = aiOutputsResult.data ?? [];
  const isRealEstate = industry === 'inmobiliaria';
  const profileName = profile.full_name?.trim();
  const greetingName =
    profileName && !/^inmobiliaria$/i.test(profileName)
      ? firstName(profileName)
      : organizationResult.data?.name?.trim() || firstName(profileName);
  const operationBasePath = isRealEstate ? '/operaciones' : '/expedientes';

  const activeCases = cases.filter((item) => isCaseActive(item.status));

  const analyzedDocumentIds = new Set(
    aiOutputs.map((item) => String(item.document_id || '')).filter(Boolean)
  );
  const coverage = documents.length
    ? Math.round((analyzedDocumentIds.size / documents.length) * 100)
    : 0;
  const memberCount = memberResult.count ?? 0;

  const hasCase = cases.length > 0;
  const hasDocument = documents.length > 0;
  const showGettingStarted = !hasCase || !hasDocument;

  const metrics = [
    {
      label: `${terms.expedientePlural} ${terms.adjetivoActivos}`,
      value: String(activeCases.length).padStart(2, '0'),
      helper: activeCases.length === 1 ? '1 abierta en este momento' : `${activeCases.length} abiertas en este momento`,
    },
    {
      label: 'Documentos',
      value: String(documents.length).padStart(2, '0'),
      helper: documents.length === 1 ? '1 documento en la bóveda' : `${documents.length} documentos en la bóveda`,
    },
    {
      label: 'Cobertura de análisis',
      value: `${coverage}%`,
      helper: documents.length ? `${analyzedDocumentIds.size} de ${documents.length} con análisis disponible` : 'Todavía no hay documentos',
    },
    {
      label: 'Equipo',
      value: String(memberCount).padStart(2, '0'),
      helper: memberCount === 1 ? '1 integrante con acceso' : `${memberCount} integrantes con acceso`,
    },
  ];

  const workspaces = [
    {
      title: 'Agenda',
      detail: 'Calendario, vencimientos, firmas y alertas.',
      href: '/agenda',
    },
    {
      title: 'Documentos',
      detail: 'Bóveda, vigencias y análisis documental.',
      href: '/documentos',
    },
    {
      title: 'Observaciones',
      detail: 'Excepciones y datos que requieren revisión.',
      href: '/observaciones',
    },
  ];

  return (
    <AppShell>
      <DashboardView industry={industry} terms={terms} greetingName={greetingName}
        role={role} userName={profile.full_name} metrics={metrics} workspaces={workspaces}
        activeCases={activeCases} operationBasePath={operationBasePath}
        hasCase={hasCase} hasDocument={hasDocument} hasTeam={memberCount > 1}
        showGettingStarted={showGettingStarted} />
    </AppShell>
  );
}
