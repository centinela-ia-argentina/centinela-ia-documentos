import Link from 'next/link';
import { MagnifyingGlass, X } from '@phosphor-icons/react/dist/ssr';
import { AppButtonLink } from '@/components/ui/AppButton';
import { getClientStatusLabel, getClientTypeLabel, getOperationInterestLabel, getDesiredPropertyTypeLabel } from '@/lib/clients/labels';
import type { ClientRecord } from '@/types/client';
import styles from './Clientes.module.css';

export type ClientesFilters = { q: string; estado?: string };

const segments: { label: string; estado?: string }[] = [
  { label: 'Todos' },
  { label: 'Activos', estado: 'activo' },
  { label: 'En seguimiento', estado: 'en_seguimiento' },
  { label: 'Cerrados', estado: 'cerrado' },
  { label: 'Descartados', estado: 'descartado' },
];

function buildHref(basePath: string, q: string, estado?: string) {
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(estado ? { estado } : {}) });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function budgetLabel(amount: number | null, currency: string | null) {
  if (amount == null || !Number.isFinite(amount)) return null;
  const value = amount.toLocaleString('es-AR');
  if (currency === 'USD') return `u$s ${value}`;
  if (currency === 'ARS') return `$ ${value}`;
  return currency ? `${currency} ${value}` : `${value} · moneda sin definir`;
}

/** Listado denso de cartera de clientes, alineado al patrón aprobado de Operaciones. */
export function ClientesList({ records, filters, basePath, totalActivos }: { records: ClientRecord[]; filters: ClientesFilters; basePath: string; totalActivos: number }) {
  const activeSegment = segments.find(s => s.estado === filters.estado) ?? segments[0];
  return <>
    <section className={styles.tools} aria-label="Controles del listado">
      <nav className={styles.segments} aria-label="Estado de los clientes">
        {segments.map(s => (
          <Link key={s.label} href={buildHref(basePath, filters.q, s.estado)} aria-current={s.estado === activeSegment.estado ? 'page' : undefined}>{s.label}</Link>
        ))}
      </nav>
      <form method="get" action={basePath} className={styles.searchForm}>
        {filters.estado ? <input type="hidden" name="estado" value={filters.estado} /> : null}
        <label className={styles.searchBox}>
          <span className={styles.srOnly}>Buscar clientes por nombre, zona o contacto</span>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Buscar por nombre, zona o contacto" />
        </label>
        {filters.q ? <Link href={buildHref(basePath, '', filters.estado)} className={styles.clear} aria-label="Limpiar búsqueda"><X size={14} aria-hidden="true" /></Link> : null}
      </form>
    </section>
    <section aria-label="Listado de clientes">
      <header className={styles.listSummary}>
        <div>
          <h2>{activeSegment.label === 'Todos' ? 'Clientes en la cartera' : activeSegment.label}</h2>
          <p>Ordenados por alta más reciente.</p>
        </div>
        <span>{records.length === totalActivos ? `${records.length} ${records.length === 1 ? 'cliente' : 'clientes'}` : `${records.length} de ${totalActivos} ${totalActivos === 1 ? 'cliente' : 'clientes'}`}</span>
      </header>
      {records.length > 0 ? (
        <table className={styles.records}>
          <thead><tr>
            <th scope="col">Cliente</th><th scope="col">Búsqueda</th><th scope="col">Estado</th>
            <th scope="col">Presupuesto máx.</th><th scope="col">Contacto</th><th scope="col"><span className={styles.srOnly}>Acciones</span></th>
          </tr></thead>
          <tbody>
            {records.map(client => {
              const name = client.name || 'Cliente sin nombre';
              const criteriaTitle = [
                client.operation_interest ? getOperationInterestLabel(client.operation_interest) : null,
                client.desired_property_type ? getDesiredPropertyTypeLabel(client.desired_property_type) : null,
              ].filter(Boolean).join(' · ');
              const budget = budgetLabel(client.budget_max, client.currency);
              const contact = client.phone || client.email || null;
              return (
                <tr key={client.id}>
                  <td>
                    <Link className={styles.recordTitle} href={`/clientes/${client.id}`}>{name}</Link>
                    <span className={styles.type}>{getClientTypeLabel(client.client_type)}</span>
                  </td>
                  <td data-label="Búsqueda">
                    {criteriaTitle ? <span className={styles.criteria}>{criteriaTitle}</span> : <span className={styles.missing}>Sin criterios específicos</span>}
                    <span className={styles.type}>{client.zone || 'Zona sin definir'}</span>
                  </td>
                  <td data-label="Estado"><span className={styles.stateTag} data-status={client.status?.toLowerCase() || 'undefined'}>{getClientStatusLabel(client.status)}</span></td>
                  <td data-label="Presupuesto máx.">{budget ? <span className={styles.mono}>{budget}</span> : <span className={styles.missing}>Sin definir</span>}</td>
                  <td data-label="Contacto">{contact ? <span className={styles.contactText}>{contact}</span> : <span className={styles.missing}>Sin contacto registrado</span>}</td>
                  <td className={styles.rowActions}>
                    <AppButtonLink href={`/clientes/${client.id}`} variant="secondary" aria-label={`Ver ficha: ${name}`}>Ver ficha</AppButtonLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className={styles.noMatches}>
          <h3>{filters.q || filters.estado ? 'No hay coincidencias con este filtro' : 'Todavía no hay clientes registrados'}</h3>
          <p>{filters.q || filters.estado ? 'Probá otro nombre, zona o contacto. La cartera no cambia: solo el recorte de esta vista.' : 'Cuando agregues un cliente, aparecerá acá con su estado y sus criterios de búsqueda.'}</p>
          {(filters.q || filters.estado) && <Link href={basePath} className={styles.clearLink}>Limpiar filtros</Link>}
        </div>
      )}
    </section>
  </>;
}
