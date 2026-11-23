import Link from 'next/link';
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react/dist/ssr';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import type { PropertyRecord } from '@/types/property';
import styles from './Propiedades.module.css';

export type PropiedadesFilters = { q: string; estado?: string };

const segments: { label: string; estado?: string }[] = [
  { label: 'Todas' },
  { label: 'Disponibles', estado: 'disponible' },
  { label: 'Reservadas', estado: 'reservada' },
  { label: 'Vendidas', estado: 'vendida' },
  { label: 'Alquiladas', estado: 'alquilada' },
];

function buildHref(basePath: string, q: string, estado?: string) {
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(estado ? { estado } : {}) });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Cartera de propiedades como índice editorial: cada registro, un número; nombre grande y precio protagonista. */
export function PropiedadesList({ records, filters, basePath, totalActivas }: { records: PropertyRecord[]; filters: PropiedadesFilters; basePath: string; totalActivas: number }) {
  const activeSegment = segments.find(s => s.estado === filters.estado) ?? segments[0];
  const searchHref = buildHref(basePath, '', filters.estado);
  return <>
    <section className={styles.tools} aria-label="Controles del listado">
      <nav className={styles.segments} aria-label="Estado de las propiedades">
        {segments.map(s => (
          <Link key={s.label} href={buildHref(basePath, filters.q, s.estado)} aria-current={s.estado === activeSegment.estado ? 'page' : undefined}>{s.label}</Link>
        ))}
      </nav>
      <form method="get" action={basePath} className={styles.searchForm}>
        {filters.estado ? <input type="hidden" name="estado" value={filters.estado} /> : null}
        <label className={styles.searchBox}>
          <span className={styles.srOnly}>Buscar propiedades por nombre o dirección</span>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Buscar por nombre o dirección" />
        </label>
        {filters.q ? <Link href={searchHref} className={styles.clear} aria-label="Limpiar búsqueda"><X size={14} aria-hidden="true" /></Link> : null}
      </form>
    </section>
    <section aria-label="Listado de propiedades">
      <header className={styles.listSummary}>
        <div>
          <h2>{activeSegment.label === 'Todas' ? 'Propiedades en la cartera' : activeSegment.label}</h2>
          <p>El listado lee como una guía de la cartera: nombre, ubicación y valor de un vistazo.</p>
        </div>
        <span>{records.length === totalActivas ? `${records.length} ${records.length === 1 ? 'propiedad' : 'propiedades'}` : `${records.length} de ${totalActivas} ${totalActivas === 1 ? 'propiedad' : 'propiedades'}`}</span>
      </header>
      {records.length > 0 ? (
        <ol className={styles.index}>
          {records.map((property, position) => {
            const name = property.name || 'Propiedad sin nombre';
            const href = `/propiedades/${property.id}`;
            const price = property.price == null ? null : `${property.currency === 'USD' ? 'u$s' : '$'} ${property.price.toLocaleString('es-AR')}`;
            const typeLabel = property.property_type ? getPropertyTypeLabel(property.property_type) : null;
            const address = property.address || 'Dirección no cargada';
            return (
              <li key={property.id} className={styles.row}>
                <span className={styles.no} aria-hidden="true">{String(position + 1).padStart(2, '0')}</span>
                <span className={styles.title}>
                  <Link className={styles.recordTitle} href={href}>{name}</Link>
                  <span className={styles.meta}>
                    {typeLabel ? <span className={styles.type}>{typeLabel}</span> : null}
                    {typeLabel ? <span className={styles.sep} aria-hidden="true">·</span> : null}
                    <span className={styles.addr}>{address}</span>
                  </span>
                </span>
                <span className={styles.aux}>
                  <span className={styles.stateTag} data-status={property.status?.toLowerCase() || 'undefined'}>{getPropertyStatusLabel(property.status)}</span>
                  <span className={styles.data}>
                    {price ? <span className={styles.mono}>{price}</span> : <span className={styles.missing}>Precio no cargado</span>}
                    <small className={styles.dataSub}>
                      {property.surface_total_m2 == null ? <span className={styles.missing}>No cargada</span> : <span className={styles.mono}>{`${property.surface_total_m2} m²`}</span>}
                    </small>
                  </span>
                </span>
                <Link className={styles.go} href={href} aria-label={`Ver ficha: ${name}`}>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.noMatches}>
          <h3>{filters.q || filters.estado ? 'No hay coincidencias con este filtro' : 'Todavía no hay propiedades cargadas'}</h3>
          <p>{filters.q || filters.estado ? 'Probá otro nombre, dirección o estado. La cartera no cambia: solo el recorte de esta vista.' : 'Cuando agregues una propiedad, aparecerá acá con su estado y sus datos principales.'}</p>
          {(filters.q || filters.estado) && <Link href={basePath} className={styles.clearLink}>Limpiar filtros</Link>}
        </div>
      )}
    </section>
  </>;
}
