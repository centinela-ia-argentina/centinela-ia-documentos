import Link from 'next/link';
import { HouseLine, Key, MagnifyingGlass, X } from '@phosphor-icons/react/dist/ssr';
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

/** Iniciales de la persona: hasta dos palabras, primera letra de cada una, en mayúsculas. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  const first = words[0]?.charAt(0) ?? '';
  const second = words[1]?.charAt(0) ?? '';
  return `${first}${second}`.toUpperCase() || '—';
}

/** Cartera de clientes como archivo de personas: ficha con iniciales, criterio al centro, presupuesto en mono. */
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
          <p>Cada ficha, una persona: criterio de búsqueda, presupuesto y contacto.</p>
        </div>
        <span>{records.length === totalActivos ? `${records.length} ${records.length === 1 ? 'cliente' : 'clientes'}` : `${records.length} de ${totalActivos} ${totalActivos === 1 ? 'cliente' : 'clientes'}`}</span>
      </header>
      {records.length > 0 ? (
        <ul className={styles.cards}>
          {records.map(client => {
            const name = client.name || 'Cliente sin nombre';
            const href = `/clientes/${client.id}`;
            const criteriaTitle = [
              client.operation_interest ? getOperationInterestLabel(client.operation_interest) : null,
              client.desired_property_type ? getDesiredPropertyTypeLabel(client.desired_property_type) : null,
            ].filter(Boolean).join(' · ');
            const budget = budgetLabel(client.budget_max, client.currency);
            const contact = client.phone || client.email || null;
            return (
              <li key={client.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.initial} aria-hidden="true">{initialsOf(name)}</span>
                  <span className={styles.ident}>
                    <Link className={styles.recordTitle} href={href}>{name}</Link>
                    <span className={styles.type}>{getClientTypeLabel(client.client_type)}</span>
                  </span>
                  <span className={styles.stateTag} data-status={client.status?.toLowerCase() || 'undefined'}>{getClientStatusLabel(client.status)}</span>
                </div>
                <div className={styles.criteria}>
                  {criteriaTitle ? <>
                    {client.operation_interest === 'alquiler' ? <Key size={16} aria-hidden="true" /> : <HouseLine size={16} aria-hidden="true" />}
                    <span>{criteriaTitle}</span>
                  </> : <span className={styles.missing}>Sin criterios específicos</span>}
                </div>
                <div className={styles.zone}>{client.zone || 'Zona sin definir'}</div>
                <div className={styles.cardData}>
                  <span className={styles.budget}>
                    <span className={styles.dataLabel}>Presupuesto máx.</span>
                    {budget ? <span className={styles.mono}>{budget}</span> : <span className={styles.missing}>Sin definir</span>}
                  </span>
                  {client.min_rooms != null ? (
                    <span className={styles.rooms}>
                      <span className={styles.dataLabel}>Ambientes</span>
                      <span className={styles.mono}>{`${client.min_rooms}+`}</span>
                    </span>
                  ) : null}
                  <span className={styles.contact}>
                    {contact ? contact : <span className={styles.missing}>Sin contacto registrado</span>}
                  </span>
                  <AppButtonLink href={href} variant="secondary" aria-label={`Ver ficha: ${name}`}>Ver ficha</AppButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
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
