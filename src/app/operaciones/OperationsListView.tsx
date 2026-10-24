import Link from 'next/link';
import { ArrowUpRight, CaretLeft, CaretRight, MagnifyingGlass, Plus, X } from '@phosphor-icons/react/dist/ssr';
import type { CaseRecord } from '@/types/case';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/industries/caseConfig';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus, expiryStatusLabel } from '@/lib/documents/expiry';
import { formatPlazoDate } from '@/lib/format/date';
import { AppButton, AppButtonLink } from '@/components/ui/AppButton';
import { OperationsRowMenu } from './OperationsRowMenu';
import styles from './RecordList.module.css';

type Props = {
  records: CaseRecord[];
  statusesByCase: Record<string, string[]>;
  basePath: string;
  industry?: IndustryType;
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
  return value?.trim() || fallback;
}
function pageHref(basePath: string, rawQ: string | undefined, estado: string | undefined, page: number) {
  return `${basePath}?${new URLSearchParams({ ...(rawQ ? { q: rawQ } : {}), ...(estado ? { estado } : {}), page: page.toString() }).toString()}`;
}

/** Presentación V1 aprobada; carga, filtros y paginación siguen en CasesPage. */
export function OperationsListView({ records, statusesByCase, basePath, industry = 'inmobiliaria', rawQ, estado, page, totalPages, totalCount, start, end, terms, canArchive, canDelete, hasError, isCountError, searchError }: Props) {
  const archived = estado === 'archivadas';
  const property = industry === 'inmobiliaria';
  return <div className={styles.listado}>
    <header className={styles.listHead}>
      <div><p className={styles.eyebrow}>{terms.listaEyebrow}</p>
        <h1>{property ? 'Operaciones' : terms.listaTitulo}</h1>
        <p>{property ? 'Seguimiento de clientes, documentación y fechas clave de cada operación.' : terms.listaSubtitulo}</p>
      </div>
      <AppButtonLink href={`${basePath}/nueva`}><Plus size={16} aria-hidden />{terms.nuevoCta}</AppButtonLink>
    </header>
    <section className={styles.tools} aria-label="Controles del listado">
      <nav className={styles.segments} aria-label="Estado de los registros">
        <Link href={basePath} aria-current={!archived ? 'page' : undefined}>Activas</Link>
        <Link href={`${basePath}?estado=archivadas`} aria-current={archived ? 'page' : undefined}>Archivadas</Link>
      </nav>
      <form method="get" action={basePath} className={styles.searchForm}>
        {estado ? <input type="hidden" name="estado" value={estado} /> : null}
        <label className={styles.searchBox}><span className={styles.srOnly}>Buscar registros por título, cliente o tipo</span>
          <MagnifyingGlass size={16} aria-hidden />
          <input type="search" name="q" defaultValue={rawQ ?? ''} placeholder="Buscar por título, cliente o tipo" aria-describedby="record-search-hint" />
          {rawQ ? <Link href={estado ? `${basePath}?estado=${estado}` : basePath} aria-label="Limpiar búsqueda"><X size={14} /></Link> : null}
        </label>
        <AppButton type="submit" variant="secondary">Buscar</AppButton>
      </form>
    </section>
    <p id="record-search-hint" className={styles.srOnly}>Máximo 100 caracteres; no se admiten porcentaje, guion bajo, barra invertida, comillas dobles ni paréntesis.</p>
    <section aria-labelledby="operations-list-title">
      <header className={styles.listSummary}><div><h2 id="operations-list-title">{archived ? `${terms.expedientePlural} archivad${property ? 'as' : 'os'}` : 'Cartera activa'}</h2><p>Ordenadas por última actualización.</p></div><span>{totalCount} {totalCount === 1 ? terms.expedienteSingular.toLowerCase() : terms.expedientePlural.toLowerCase()}</span></header>
      {records.length ? <table className={styles.records}>
        <thead><tr><th scope="col">{terms.expedienteSingular}</th><th scope="col">Cliente</th><th scope="col">Estado</th><th scope="col">Documentación</th><th scope="col">Fecha clave</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{records.map(item => {
          const progress = summarizeChecklistStatuses(statusesByCase[item.id] || []);
          const date = ((item.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined)?.trim();
          const expiry = date ? getDocumentExpiryStatus(date) : null;
          const title = displayText(item.title, terms.itemSinTitulo);
          return <tr key={item.id}>
            <td><Link className={styles.recordTitle} href={`${basePath}/${item.id}`}>{title}</Link><span className={styles.type}>{getCaseTypeLabel(item.case_type)}</span></td>
            <td data-label="Cliente">{displayText(item.client_name, property ? 'Sin cliente' : 'Sin cliente asignado')}</td>
            <td><span className={styles.statusTag}>{getCaseStatusLabel(item.status, industry)}</span></td>
            <td data-label="Documentación"><span className={styles.progressText}>{!progress.total ? 'Sin checklist' : property ? `${progress.fulfilled}/${progress.total} · ${progress.percent}%` : progress.isComplete ? 'Completo' : `Sugeridos ${progress.total - progress.missing}/${progress.total}`}</span>
              {property && progress.total ? <span className={styles.progressBar}><span style={{width:`${progress.percent}%`}} /></span> : null}
            </td>
            <td data-label="Fecha clave">{date ? <><span className={styles.dateText}>{formatPlazoDate(date)}</span><span className={`${styles.dateState} ${expiry === 'vencido' ? styles.late : ''}`}>{property ? expiry === 'vencido' ? 'Vencida' : expiry === 'por_vencer' ? 'Próxima' : 'Vigente' : expiryStatusLabel(expiry!)}</span></> : <span className={styles.dateText}>Sin fecha clave</span>}</td>
            <td><div className={styles.rowActions}><AppButtonLink href={`${basePath}/${item.id}`} variant="secondary" aria-label={`Abrir ${title}`}><span>Abrir</span><ArrowUpRight size={14} aria-hidden /></AppButtonLink>
              {canArchive || canDelete ? <OperationsRowMenu caseId={item.id} title={title} industry={industry} isArchived={item.status === 'archived' || item.status === 'Archivado'} canArchive={canArchive} canDelete={canDelete} /> : null}
            </div></td>
          </tr>;
        })}</tbody>
      </table> : null}
      {!records.length || (!property && (isCountError || searchError)) ? <div className={styles.emptyState} role={hasError || isCountError || searchError ? 'status' : undefined}>
        <h3>{hasError ? property ? 'No pudimos cargar las operaciones.' : `Ocurrió un error al cargar ${terms.losExpedientes}.` : isCountError ? `No pudimos obtener el total de ${terms.expedientePlural.toLowerCase()}.` : searchError ? 'La búsqueda no es válida.' : rawQ ? `${terms.vacioSinResultados} «${rawQ}».` : terms.vacioSinDatos}</h3>
        <p>{hasError || isCountError ? 'Recargá la página en unos instantes.' : searchError ? 'Usá hasta 100 caracteres y evitá %, _, comillas y paréntesis.' : terms.vacioAyuda}</p>
        {property && !rawQ && !hasError && !isCountError && !searchError ? <AppButtonLink href={`${basePath}/nueva`}><Plus size={16} aria-hidden />{terms.nuevoCta}</AppButtonLink> : null}
      </div> : null}
    </section>
    {!isCountError && !searchError && totalCount > 0 ? <footer className={styles.pagination}>
      <p>Mostrando {start + 1}–{Math.min(end + 1, totalCount)} de {totalCount}</p>
      <nav className={styles.pages} aria-label="Paginación">
        <AppButtonLink variant="secondary" href={pageHref(basePath, rawQ, estado, Math.max(1,page-1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}><CaretLeft size={14} aria-hidden />Anterior</AppButtonLink>
        <span>{page} / {totalPages}</span>
        <AppButtonLink variant="secondary" href={pageHref(basePath, rawQ, estado, Math.min(totalPages,page+1))} aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined}>Siguiente<CaretRight size={14} aria-hidden /></AppButtonLink>
      </nav>
    </footer> : null}
  </div>;
}
