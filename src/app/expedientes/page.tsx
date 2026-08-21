import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/industries/caseConfig';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus, expiryStatusLabel } from '@/lib/documents/expiry';
import { formatPlazoDate } from '@/lib/format/date';
import { Badge } from '@/components/ui/Badge';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import type { CaseRecord } from '@/types/case';
import { Calendar, User, FileText, ArrowRight } from 'lucide-react';
import { isUserRole, canArchiveCase, canDeleteCase } from '@/lib/permissions/roles';
import { CaseCardMenu } from './CaseCardMenu';

function displayText(value?: string | null, fallback = 'Sin definir') {
  const cleanValue = value?.trim();
  if (!cleanValue) return fallback;
  return cleanValue;
}

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

  let queryBuilder = supabase
    .from('cases')
    .select('id, title, client_name, case_type, status, metadata, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', profile.organization_id);

  let cases: CaseRecord[] | null = null;
  let count: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      redirect(`/expedientes?${url.toString()}`);
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
    redirect(`/expedientes?${url.toString()}`);
  }

  if (pageError && rawPage) {
    const url = new URLSearchParams();
    if (rawQ) url.set('q', rawQ);
    if (estado) url.set('estado', estado);
    url.set('page', '1');
    redirect(`/expedientes?${url.toString()}`);
  }

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const organizationIndustry = normalizeIndustryType(organization?.industry_type);
  const terms = getIndustryTerms(organizationIndustry);
  const records = (cases ?? []) as CaseRecord[];

  let statusesByCase: Record<string, string[]> = {};
  if (records.length > 0) {
    const caseIds = records.map((c) => c.id);
    const { data: checklistItems } = await supabase
      .from('checklist_items')
      .select('status, checklists!inner(case_id)')
      .eq('checklists.organization_id', profile.organization_id)
      .in('checklists.case_id', caseIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            {terms.listaEyebrow}
          </p>

          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
            {terms.listaTitulo}
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {terms.listaSubtitulo}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={estado === 'archivadas' ? '/expedientes' : '/expedientes?estado=archivadas'}
            className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-all ${
              estado === 'archivadas' 
                ? 'border-sky-400 bg-sky-400/10 text-sky-400' 
                : 'border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            {estado === 'archivadas' ? 'Ver activas' : 'Ver archivadas'}
          </Link>
          <Link href="/expedientes/nuevo">
            <MotionButton className="bg-gradient-to-r from-accent to-brandviolet text-white">
              ＋ {terms.nuevoCta}
            </MotionButton>
          </Link>
        </div>
      </div>

      <form method="get" action="/expedientes" className="mb-6 flex gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          type="search"
          name="q"
          defaultValue={rawQ ?? ''}
          placeholder={`Buscar por ${terms.expedienteSingular.toLowerCase()}, cliente o tipo…`}
          className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <MotionButton type="submit" className="bg-white/10 text-white hover:bg-white/20">
          Buscar
        </MotionButton>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {records.map((item, i) => {
          const statuses = statusesByCase[item.id] || [];
          const progress = summarizeChecklistStatuses(statuses);
          const plazo = ((item.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined)?.trim();
          const plazoStatus = plazo ? getDocumentExpiryStatus(plazo) : null;

          return (
            <div key={item.id} className="relative h-full">
              <Link href={`/expedientes/${item.id}`} className="block h-full">
                <MotionCard index={i} className="group relative flex h-full flex-col justify-between cursor-pointer">
                  <div>
                    <div className="mr-8 flex flex-wrap items-start justify-between gap-2">
                      <Badge tone="accent">{getCaseStatusLabel(item.status, organizationIndustry)}</Badge>
                      <span className="min-w-0 max-w-full shrink truncate break-words rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {getCaseTypeLabel(item.case_type)}
                      </span>
                    </div>

                    <h3 className="mt-4 pr-6 font-display text-lg font-semibold text-white group-hover:text-cyan-400">
                    {displayText(item.title, terms.itemSinTitulo)}
                  </h3>

                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                    <User className="h-4 w-4 opacity-50" />
                    <span>{displayText(item.client_name, 'Sin cliente asignado')}</span>
                  </div>

                  {plazo && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="h-4 w-4 opacity-50" />
                      <span>{formatPlazoDate(plazo)}</span>
                      <Badge tone={plazoStatus === 'vencido' ? 'danger' : plazoStatus === 'por_vencer' ? 'warning' : 'neutral'}>
                        {expiryStatusLabel(plazoStatus!)}
                      </Badge>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                    <FileText className="h-4 w-4 opacity-50" />
                    {progress.total === 0 ? (
                      <span className="opacity-70">Sin checklist</span>
                    ) : progress.isComplete ? (
                      <span className="text-emerald-400">Completo</span>
                    ) : (
                      <span className="text-amber-400">
                        Sugeridos {progress.total - progress.missing}/{progress.total}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs font-semibold text-cyan-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Ver detalle
                  </span>
                  <ArrowRight className="h-4 w-4 text-cyan-400 opacity-0 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </MotionCard>
            </Link>
            {(canArchive || canDelete) && (
              <CaseCardMenu
                caseId={item.id}
                isArchived={item.status === 'archived' || item.status === 'Archivado'}
                canArchive={canArchive}
                canDelete={canDelete}
              />
            )}
          </div>
          );
        })}
      </div>

      {records.length === 0 || isCountError || searchError ? (
        <MotionCard index={0} className="mt-4 text-center py-12">
          {error ? (
            <p className="font-bold text-rose-400 text-lg">
              Ocurrió un error al cargar los expedientes.
            </p>
          ) : isCountError ? (
            <p className="font-bold text-rose-400 text-lg">
              No se pudo obtener el total de expedientes. Volvé a intentarlo.
            </p>
          ) : searchError ? (
            <p className="font-bold text-amber-400 text-lg">
              Búsqueda inválida.
            </p>
          ) : rawQ ? (
            <p className="font-bold text-white text-lg">
              {terms.vacioSinResultados} «{rawQ}».
            </p>
          ) : (
            <p className="font-bold text-white text-lg">
              {terms.vacioSinDatos}
            </p>
          )}

          <p className="mt-2 text-sm text-slate-400">
            {error || isCountError ? 'Intentá recargar la página en unos instantes.' 
              : searchError ? 'Evitá caracteres especiales (%, _, comillas, paréntesis) y usá un máximo de 100 letras.'
              : terms.vacioAyuda}
          </p>
        </MotionCard>
      ) : null}

      {!isCountError && !searchError && totalCount > 0 && (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-sm text-slate-400">
            Mostrando {start + 1}–{Math.min(end + 1, totalCount)} de {totalCount} expedientes
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/expedientes?${new URLSearchParams({
                ...(rawQ ? { q: rawQ } : {}),
                ...(estado ? { estado } : {}),
                page: Math.max(1, page - 1).toString(),
              }).toString()}`}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                page <= 1
                  ? 'pointer-events-none text-slate-600'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Anterior
            </Link>
            <span className="px-4 text-sm font-semibold text-slate-400">
              Página {page} de {totalPages}
            </span>
            <Link
              href={`/expedientes?${new URLSearchParams({
                ...(rawQ ? { q: rawQ } : {}),
                ...(estado ? { estado } : {}),
                page: Math.min(totalPages, page + 1).toString(),
              }).toString()}`}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                page >= totalPages
                  ? 'pointer-events-none text-slate-600'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Siguiente
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}
