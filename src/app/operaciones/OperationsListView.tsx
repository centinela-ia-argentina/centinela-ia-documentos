import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  FileText,
  MagnifyingGlass,
  Plus,
  User,
  X,
} from '@phosphor-icons/react/dist/ssr';
import type { CaseRecord } from '@/types/case';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/industries/caseConfig';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { formatPlazoDate } from '@/lib/format/date';
import { OperationsRowMenu } from './OperationsRowMenu';

type Props = {
  records: CaseRecord[];
  statusesByCase: Record<string, string[]>;
  basePath: string;
  rawQ?: string;
  estado?: string;
  page: number;
  totalPages: number;
  totalCount: number;
  start: number;
  end: number;
  terms: IndustryTerms;
  canArchive: boolean;
  canDelete: boolean;
  hasError: boolean;
  isCountError: boolean;
  searchError: boolean;
};

function displayText(value?: string | null, fallback = 'Sin definir') {
  const clean = value?.trim();
  return clean || fallback;
}

function statusStyle(status: string) {
  if (status === 'new') return { rail: '#C8FF62', text: 'text-[#DFFF9E]', surface: 'bg-[#C8FF62]/[0.07]' };
  if (status === 'in_review') return { rail: '#F3C969', text: 'text-amber-200', surface: 'bg-amber-300/[0.06]' };
  if (status === 'waiting_client') return { rail: '#C69BFF', text: 'text-purple-200', surface: 'bg-purple-300/[0.06]' };
  if (status === 'archived' || status === 'Archivado') return { rail: '#70827C', text: 'text-[#A4B4AE]', surface: 'bg-white/[0.035]' };
  return { rail: '#85E4D4', text: 'text-[#A8EFE4]', surface: 'bg-[#85E4D4]/[0.06]' };
}

function pageHref(basePath: string, rawQ: string | undefined, estado: string | undefined, page: number) {
  return `${basePath}?${new URLSearchParams({
    ...(rawQ ? { q: rawQ } : {}),
    ...(estado ? { estado } : {}),
    page: page.toString(),
  }).toString()}`;
}

export function OperationsListView({
  records,
  statusesByCase,
  basePath,
  rawQ,
  estado,
  page,
  totalPages,
  totalCount,
  start,
  end,
  terms,
  canArchive,
  canDelete,
  hasError,
  isCountError,
  searchError,
}: Props) {
  const archived = estado === 'archivadas';

  return (
    <div className="mx-auto max-w-6xl py-2 sm:py-3">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ui text-xs font-semibold text-[#85E4D4]">Cartera · Gestión inmobiliaria</p>
          <h1 className="mt-2 font-display text-[clamp(2.35rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.06em] text-[#F3F8F5]">
            Operaciones
          </h1>
          <p className="mt-4 max-w-2xl font-ui text-sm font-medium leading-6 text-[#B8C6C1] sm:text-[16px]">
            Seguimiento de clientes, documentación y fechas clave de cada operación.
          </p>
        </div>
        <Link href={`${basePath}/nueva`} className="inline-flex min-h-12 w-fit items-center gap-3 rounded-md border border-white/60 bg-[#F3F8F5] px-5 font-ui text-sm font-bold text-[#071110] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(200,255,98,0.25),0_0_26px_rgba(200,255,98,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]">
          <Plus size={18} weight="bold" /> {terms.nuevoCta}
        </Link>
      </header>

      <section className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between" aria-label="Controles del listado">
        <form method="get" action={basePath} className="flex min-w-0 flex-1 items-center gap-2">
          {estado ? <input type="hidden" name="estado" value={estado} /> : null}
          <label className="relative min-w-0 flex-1 lg:max-w-xl">
            <span className="sr-only">Buscar operaciones</span>
            <MagnifyingGlass size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71857F]" />
            <input
              type="search"
              name="q"
              defaultValue={rawQ ?? ''}
              placeholder="Buscar operación, cliente o tipo"
              className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.025] py-2 pl-10 pr-10 font-ui text-sm text-[#E8F0ED] outline-none placeholder:text-[#61736D] focus:border-[#85E4D4]/50 focus:ring-2 focus:ring-[#85E4D4]/15"
            />
            {rawQ ? <Link href={estado ? `${basePath}?estado=${estado}` : basePath} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#71857F] hover:bg-white/[0.05] hover:text-white"><X size={14} /></Link> : null}
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-white/12 bg-white/[0.04] px-4 font-ui text-xs font-bold text-[#DDE7E3] transition hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]">Buscar</button>
        </form>

        <div className="inline-flex w-fit rounded-lg border border-white/12 bg-white/[0.018] p-1">
          <Link href={basePath} aria-current={!archived ? 'page' : undefined} className={`min-h-9 rounded-md px-3.5 py-2 font-ui text-[11px] font-bold ${!archived ? 'bg-[#F3F8F5] text-[#071110]' : 'text-[#8FA19B] hover:bg-white/[0.045] hover:text-white'}`}>Activas</Link>
          <Link href={`${basePath}?estado=archivadas`} aria-current={archived ? 'page' : undefined} className={`min-h-9 rounded-md px-3.5 py-2 font-ui text-[11px] font-bold ${archived ? 'bg-[#F3F8F5] text-[#071110]' : 'text-[#8FA19B] hover:bg-white/[0.045] hover:text-white'}`}>Archivadas</Link>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#091411] shadow-[0_24px_70px_rgba(0,0,0,0.18)]" aria-labelledby="operations-list-title">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <div>
            <h2 id="operations-list-title" className="font-display text-xl font-medium tracking-[-0.035em] text-[#F3F8F5]">{archived ? 'Operaciones archivadas' : 'Cartera activa'}</h2>
            <p className="mt-1 font-ui text-[11px] text-[#71857F]">Ordenadas por última actualización</p>
          </div>
          <span className="font-ui text-xs font-bold text-[#9FB0AB]">{totalCount} {totalCount === 1 ? 'operación' : 'operaciones'}</span>
        </div>

        {records.length ? (
          <>
            <div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(145px,.8fr)_125px_minmax(145px,.8fr)_145px_112px] gap-4 border-b border-white/[0.06] px-5 py-3 font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#61736D] lg:grid">
              <span>Operación</span><span>Cliente</span><span>Estado</span><span>Documentación</span><span>Fecha clave</span><span>Acciones</span>
            </div>
            <div className="divide-y divide-white/[0.065]">
              {records.map((item) => {
                const progress = summarizeChecklistStatuses(statusesByCase[item.id] || []);
                const relevantDate = ((item.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined)?.trim();
                const expiry = relevantDate ? getDocumentExpiryStatus(relevantDate) : null;
                const status = statusStyle(item.status);
                return (
                  <article key={item.id} className="group relative px-4 py-4 transition-colors hover:bg-white/[0.022] sm:px-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.35fr)_minmax(145px,.8fr)_125px_minmax(145px,.8fr)_145px_112px] lg:items-center">
                        <div className="grid min-w-0 grid-cols-[3px_minmax(0,1fr)] gap-3">
                          <span className="h-full min-h-11 rounded-full" style={{ background: status.rail }} />
                          <span className="min-w-0">
                            <Link href={`${basePath}/${item.id}`} className="block truncate font-ui text-sm font-bold text-[#E7EFEC] transition-colors hover:text-[#B7F0E6] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]">{displayText(item.title, terms.itemSinTitulo)}</Link>
                            <span className="mt-1 block truncate font-ui text-[11px] text-[#71857F]">{getCaseTypeLabel(item.case_type)}</span>
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2.5 font-ui text-xs text-[#A7B6B1]">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#85E4D4]/[0.055] text-[#85E4D4]"><User size={15} /></span>
                          <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-[#60736D] lg:hidden">Cliente</span><span className="block truncate">{displayText(item.client_name, 'Sin cliente')}</span></span>
                        </div>

                        <div className={`grid min-h-10 w-fit grid-cols-[3px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 py-1.5 ${status.surface}`}>
                          <span className="h-5 rounded-full" style={{ background: status.rail }} />
                          <span className={`font-ui text-[10px] font-bold leading-3.5 ${status.text}`}>{getCaseStatusLabel(item.status, 'inmobiliaria')}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2 font-ui text-[10px] text-[#8FA19B]"><span className="inline-flex items-center gap-1.5"><FileText size={14} />{progress.total ? `${progress.fulfilled}/${progress.total}` : 'Sin checklist'}</span>{progress.total ? <span>{progress.percent}%</span> : null}</div>
                          {progress.total ? <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-[#85E4D4]" style={{ width: `${progress.percent}%` }} /></span> : null}
                        </div>

                        <div className="font-ui text-[11px]">
                          {relevantDate ? <div className="flex items-center gap-2.5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${expiry === 'vencido' ? 'bg-rose-400/[0.07] text-rose-300' : expiry === 'por_vencer' ? 'bg-amber-300/[0.07] text-amber-200' : 'bg-[#85E4D4]/[0.055] text-[#85E4D4]'}`}><CalendarBlank size={15} /></span><span><span className="block text-[#C4D0CC]">{formatPlazoDate(relevantDate)}</span><span className={`mt-0.5 block text-[9px] font-bold ${expiry === 'vencido' ? 'text-rose-300' : expiry === 'por_vencer' ? 'text-amber-200' : 'text-[#71857F]'}`}>{expiry === 'vencido' ? 'Vencida' : expiry === 'por_vencer' ? 'Próxima' : 'Vigente'}</span></span></div> : <span className="text-[#60736D]">Sin fecha clave</span>}
                        </div>

                        <div className="flex items-center gap-1.5 lg:justify-end">
                          <Link href={`${basePath}/${item.id}`} aria-label={`Abrir ${displayText(item.title, terms.itemSinTitulo)}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 font-ui text-[10px] font-bold text-[#AFC0BA] transition-colors hover:border-[#85E4D4]/25 hover:bg-[#85E4D4]/[0.06] hover:text-[#B7F0E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]">
                            Abrir <ArrowUpRight size={14} />
                          </Link>
                          {(canArchive || canDelete) ? <OperationsRowMenu caseId={item.id} isArchived={item.status === 'archived' || item.status === 'Archivado'} canArchive={canArchive} canDelete={canDelete} /> : null}
                        </div>
                      </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className={`font-display text-xl font-medium ${hasError || isCountError ? 'text-rose-300' : searchError ? 'text-amber-200' : 'text-[#E7EFEC]'}`}>
              {hasError ? 'No pudimos cargar las operaciones.' : isCountError ? 'No pudimos obtener el total de operaciones.' : searchError ? 'La búsqueda no es válida.' : rawQ ? `${terms.vacioSinResultados} «${rawQ}».` : terms.vacioSinDatos}
            </p>
            <p className="mx-auto mt-2 max-w-lg font-ui text-sm leading-6 text-[#71857F]">{hasError || isCountError ? 'Recargá la página en unos instantes.' : searchError ? 'Usá hasta 100 caracteres y evitá %, _, comillas y paréntesis.' : terms.vacioAyuda}</p>
            {!rawQ && !hasError && !isCountError && !searchError ? <Link href={`${basePath}/nueva`} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#F3F8F5] px-4 font-ui text-xs font-bold text-[#071110]"><Plus size={16} />{terms.nuevoCta}</Link> : null}
          </div>
        )}
      </section>

      {!isCountError && !searchError && totalCount > 0 ? (
        <footer className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-ui text-xs text-[#71857F]">Mostrando {start + 1}–{Math.min(end + 1, totalCount)} de {totalCount}</p>
          <nav className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.015] p-1" aria-label="Paginación">
            <Link href={pageHref(basePath, rawQ, estado, Math.max(1, page - 1))} aria-disabled={page <= 1} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 font-ui text-xs font-bold transition-colors ${page <= 1 ? 'pointer-events-none text-[#4E615B]' : 'text-[#A9B8B3] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]'}`}><CaretLeft size={14} /> Anterior</Link>
            <span className="min-h-10 rounded-lg bg-white/[0.045] px-4 py-2.5 font-ui text-xs font-bold text-[#D9E3DF]"><span className="text-[#71857F]">Página</span> {page} <span className="text-[#71857F]">de</span> {totalPages}</span>
            <Link href={pageHref(basePath, rawQ, estado, Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 font-ui text-xs font-bold transition-colors ${page >= totalPages ? 'pointer-events-none text-[#4E615B]' : 'text-[#A9B8B3] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]'}`}>Siguiente <CaretRight size={14} /></Link>
          </nav>
        </footer>
      ) : null}
    </div>
  );
}
