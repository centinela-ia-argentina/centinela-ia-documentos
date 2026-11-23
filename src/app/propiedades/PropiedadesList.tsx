import Link from 'next/link';
import { MagnifyingGlass, X } from '@phosphor-icons/react/dist/ssr';
import { AppButtonLink } from '@/components/ui/AppButton';
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

/** Listado denso de cartera, alineado al patrón aprobado de Operaciones (tabla + filtros + búsqueda). */
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
          <p>Ordenadas por alta más reciente.</p>
        </div>
        <span>{records.length === totalActivas ? `${records.length} ${records.length === 1 ? 'propiedad' : 'propiedades'}` : `${records.length} de ${totalActivas} ${totalActivas === 1 ? 'propiedad' : 'propiedades'}`}</span>
      </header>
      {records.length > 0 ? (
        <table className={styles.records}>
          <thead><tr>
            <th scope="col">Propiedad</th><th scope="col">Dirección</th><th scope="col">Estado</th>
            <th scope="col">Precio registrado</th><th scope="col">Superficie</th><th scope="col"><span className={styles.srOnly}>Acciones</span></th>
          </tr></thead>
          <tbody>
            {records.map(property => {
              const name = property.name || 'Propiedad sin nombre';
              const price = property.price == null ? null : `${property.currency === 'USD' ? 'u$s' : '$'} ${property.price.toLocaleString('es-AR')}`;
              return (
                <tr key={property.id}>
                  <td>
                    <Link className={styles.recordTitle} href={`/propiedades/${property.id}`}>{name}</Link>
                    <span className={styles.type}>{getPropertyTypeLabel(property.property_type)}</span>
                  </td>
                  <td data-label="Dirección">{property.address || 'Dirección no cargada'}</td>
                  <td data-label="Estado"><span className={styles.stateTag} data-status={property.status?.toLowerCase() || 'undefined'}>{getPropertyStatusLabel(property.status)}</span></td>
                  <td data-label="Precio registrado">{price ? <span className={styles.mono}>{price}</span> : <span className={styles.missing}>Precio no cargado</span>}</td>
                  <td data-label="Superficie">{property.surface_total_m2 == null ? <span className={styles.missing}>No cargada</span> : <span className={styles.mono}>{`${property.surface_total_m2} m²`}</span>}</td>
                  <td className={styles.rowActions}>
                    <AppButtonLink href={`/propiedades/${property.id}`} variant="secondary" aria-label={`Ver ficha: ${name}`}>Ver ficha</AppButtonLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
