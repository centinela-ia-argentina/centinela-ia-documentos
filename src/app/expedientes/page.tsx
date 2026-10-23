import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getCaseBasePath, caseTypesByIndustry } from '@/lib/industries/caseConfig';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { CaseRecord } from '@/types/case';
import { isUserRole, canArchiveCase, canDeleteCase } from '@/lib/permissions/roles';
import { OperationsListView } from '@/app/operaciones/OperationsListView';

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  const params = await searchParams;
  const rawQ = params.q;
  const estado = params.estado;
  const rawPage = params.page;
  
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const CASES_PAGE_SIZE = 25;

  let page = 1;
  let pageError = false;
  if (rawPage) {
    const p = Number(rawPage);
    if (Number.isSafeInteger(p) && p > 0) {
      page = p;
    } else {
      pageError = true;
    }
  }

  let safeQ = '';
  let searchError = false;
  
  if (rawQ) {
    const trimmedQ = rawQ.trim();
    if (trimmedQ) {
      if (trimmedQ.length > 100) {
        searchError = true;
      } else if (/[%_\\"()]/.test(trimmedQ)) {
        searchError = true;
      } else {
        safeQ = trimmedQ;
      }
    }
  }

  const organizationIndustry = await getStrictIndustryForOrganization(profile.organization_id);
  const canonicalTypes = caseTypesByIndustry[organizationIndustry] ?? [];
  const basePath = getCaseBasePath(organizationIndustry);

  let queryBuilder = supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', profile.organization_id);

  if (canonicalTypes.length > 0) {
    queryBuilder = queryBuilder.in('case_type', canonicalTypes);
  }

  let cases: CaseRecord[] | null = null;
  let count: number | null = null;
  let error: any = null;

  const start = (page - 1) * CASES_PAGE_SIZE;
  const end = start + CASES_PAGE_SIZE - 1;

  if (searchError) {
    cases = [];
    count = 0;
  } else {
    if (estado === 'archivadas') {
      queryBuilder = queryBuilder.in('status', ['archived', 'Archivado']);
    } else {
      queryBuilder = queryBuilder.not('status', 'in', '("archived","Archivado")');
    }

    if (safeQ) {
      queryBuilder = queryBuilder.or(`title.ilike."%${safeQ}%",client_name.ilike."%${safeQ}%",case_type.ilike."%${safeQ}%"`);
    }

    queryBuilder = queryBuilder
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    queryBuilder = queryBuilder.range(start, end);

    const result = await queryBuilder;
    
    if (result.error && (result.error.code === 'PGRST103' || (result.error.message && result.error.message.toLowerCase().includes('range')))) {
      // Out of range error (HTTP 416). Fetch exact count to find the last page.
      let countQb = supabase.from('cases').select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);

      if (canonicalTypes.length > 0) {
        countQb = countQb.in('case_type', canonicalTypes);
      }
      
      if (estado === 'archivadas') countQb = countQb.in('status', ['archived', 'Archivado']);
      else countQb = countQb.not('status', 'in', '("archived","Archivado")');
      
      if (safeQ) countQb = countQb.or(`title.ilike."%${safeQ}%",client_name.ilike."%${safeQ}%",case_type.ilike."%${safeQ}%"`);
      
      const countRes = await countQb;
      const realCount = countRes.count ?? 0;
      const correctTotalPages = Math.max(1, Math.ceil(realCount / CASES_PAGE_SIZE));
      
      const url = new URLSearchParams();
      if (rawQ) url.set('q', rawQ);
      if (estado) url.set('estado', estado);
      url.set('page', correctTotalPages.toString());
      
      // La llamada a redirect aborta la ejecución normal (arroja NEXT_REDIRECT)
      redirect(`${basePath}?${url.toString()}`);
    }

    cases = result.data as unknown as CaseRecord[];
    count = result.count;
    error = result.error;
  }

  const isCountError = count === null && !searchError && !error;
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / CASES_PAGE_SIZE));

  if (!isCountError && page > totalPages && totalCount > 0) {
    const url = new URLSearchParams();
    if (rawQ) url.set('q', rawQ);
    if (estado) url.set('estado', estado);
    url.set('page', totalPages.toString());
    redirect(`${basePath}?${url.toString()}`);
  }

  if (pageError && rawPage) {
    const url = new URLSearchParams();
    if (rawQ) url.set('q', rawQ);
    if (estado) url.set('estado', estado);
    url.set('page', '1');
    redirect(`${basePath}?${url.toString()}`);
  }

  const terms = getIndustryTerms(organizationIndustry);
  let records = (cases ?? []) as CaseRecord[];

  let statusesByCase: Record<string, string[]> = {};
  if (records.length > 0) {
    const caseIds = records.map((c) => c.id);
    const { data: checklistItems } = await supabase
      .from('checklist_items')
      .select('status, checklists!inner(case_id)')
      .eq('checklists.organization_id', profile.organization_id)
      .in('checklists.case_id', caseIds);

    statusesByCase = (checklistItems ?? []).reduce((acc: Record<string, string[]>, item: any) => {
      const caseId = item.checklists.case_id;
      if (!acc[caseId]) acc[caseId] = [];
      acc[caseId].push(item.status);
      return acc;
    }, {});
  }

  const canArchive = isUserRole(profile.role) && canArchiveCase(profile.role);
  const canDelete = isUserRole(profile.role) && canDeleteCase(profile.role);

  return (
    <AppShell>
      <OperationsListView
        records={records}
        statusesByCase={statusesByCase}
        basePath={basePath}
        industry={organizationIndustry}
        rawQ={rawQ}
        estado={estado}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        start={start}
        end={end}
        terms={terms}
        canArchive={canArchive}
        canDelete={canDelete}
        hasError={Boolean(error)}
        isCountError={isCountError}
        searchError={searchError}
      />
    </AppShell>
  );
}
