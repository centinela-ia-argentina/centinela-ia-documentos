import Link from 'next/link';
import { Buildings, HouseLine, MagnifyingGlass, Storefront, X } from '@phosphor-icons/react/dist/ssr';
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

/** Icono según el tipo de propiedad: casa/PH → casa, local/terreno/oficina → comercio, resto → edificio. */
function typeIcon(propertyType: string | null, size: number) {
  const t = (propertyType || '').toLowerCase();
  if (t.includes('casa') || t.includes('ph') || t.includes('quinta') || t.includes('duplex')) return <HouseLine size={size} aria-hidden="true" />;
  if (t.includes('local') || t.includes('terreno') || t.includes('galpon') || t.includes('oficina') || t.includes('cochera') || t.includes('quiosco')) return <Storefront size={size} aria-hidden="true" />;
  return <Buildings size={size} aria-hidden="true" />;
}

/** Cartera de propiedades como vitrina de expedientes: tapa tintada por estado, precio héroe en mono. */
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
          <p>Cada ficha, un expediente: tipo, ubicación y valor de la propiedad.</p>
        </div>
        <span>{records.length === totalActivas ? `${records.length} ${records.length === 1 ? 'propiedad' : 'propiedades'}` : `${records.length} de ${totalActivas} ${totalActivas === 1 ? 'propiedad' : 'propiedades'}`}</span>
      </header>
      {records.length > 0 ? (
        <ol className={styles.cards}>
          {records.map((property, position) => {
            const name = property.name || 'Propiedad sin nombre';
            const href = `/propiedades/${property.id}`;
            const price = property.price == null ? null : `${property.currency === 'USD' ? 'u$s' : '$'} ${property.price.toLocaleString('es-AR')}`;
            const typeLabel = property.property_type ? getPropertyTypeLabel(property.property_type) : null;
            const status = property.status?.toLowerCase() || 'undefined';
            return (
              <li key={property.id} className={styles.card}>
                <div className={styles.cover} data-status={status}>
                  <span className={styles.no} aria-hidden="true">{String(position + 1).padStart(2, '0')}</span>
                  {typeIcon(property.property_type, 20)}
                  {typeLabel ? <span className={styles.tp}>{typeLabel}</span> : null}
                  <span className={styles.stateTag} data-status={status}>{getPropertyStatusLabel(property.status)}</span>
                </div>
                <div className={styles.body}>
                  <Link className={styles.recordTitle} href={href}>{name}</Link>
                  <div className={styles.adr}>{property.address || 'Dirección no cargada'}</div>
                  <div className={styles.cardData}>
                    <span className={styles.budget}>
                      <span className={styles.dataLabel}>Precio</span>
                      {price ? <span className={styles.mono}>{price}</span> : <span className={styles.missing}>Precio no cargado</span>}
                    </span>
                    <span className={styles.surface}>
                      <span className={styles.dataLabel}>Superficie</span>
                      {property.surface_total_m2 == null ? <span className={styles.missing}>No cargada</span> : <span className={styles.mono}>{`${property.surface_total_m2} m²`}</span>}
                    </span>
                    <AppButtonLink href={href} variant="secondary" aria-label={`Ver ficha: ${name}`}>Ver ficha</AppButtonLink>
                  </div>
                </div>
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
