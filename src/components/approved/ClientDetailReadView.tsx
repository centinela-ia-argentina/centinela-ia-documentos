import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import type { ResultadoMatch } from '@/lib/matching/match';
import { getOperationInterestLabel, getDesiredPropertyTypeLabel } from '@/lib/clients/labels';
import styles from './ApprovedDetail.module.css';

const columns = [{ key: 'tipo', label: 'Tipo' }, { key: 'presupuesto', label: 'Presupuesto' }, { key: 'ambientes', label: 'Ambientes' }, { key: 'zona', label: 'Zona' }] as const;
const amount = (value: number | null | undefined) => value == null ? 'No informado' : value.toLocaleString('es-AR');

export function MatchStatus({ meets }: { meets: boolean }) {
  const Icon = meets ? Check : X;
  return <span className={`${styles.matchStatus} ${meets ? '' : styles.notMet}`}><Icon size={14} aria-hidden="true" /><span>{meets ? 'Cumple' : 'No cumple'}</span></span>;
}

export function ClientDetailReadView({ record, matches, aiAction, contactMessage }: {
  record: ClientRecord; matches: { item: PropertyRecord; match: ResultadoMatch }[]; aiAction: ReactNode; contactMessage: ReactNode;
}) {
  return <>
    <section className={styles.contactRibbon} aria-label="Contacto">
      <dl><div><dt>Teléfono</dt><dd>{record.phone || 'No informado'}</dd></div><div><dt>Email</dt><dd>{record.email || 'No informado'}</dd></div></dl>
      <div className={styles.messageHost}>{contactMessage}</div>
    </section>
    <section className={styles.searchBrief} aria-labelledby="client-search-title">
      <header><h2 id="client-search-title">Qué busca</h2><span className={styles.muted}>Datos de su búsqueda</span></header>
      <div className={styles.briefGrid}>
        <div><p className={styles.muted}>Interés y propiedad</p><h3>{getOperationInterestLabel(record.operation_interest)} · {getDesiredPropertyTypeLabel(record.desired_property_type)}</h3>
          <p>{[record.desired_neighborhood || record.zone, record.desired_city].filter(Boolean).join(' · ') || 'Ubicación no informada'}</p>
          <p className={styles.small}>Provincia: {record.desired_province || 'No informada'}<br />Subzona: {record.desired_subzone || 'No informada'}</p>
        </div>
        <div><p className={styles.muted}>Presupuesto</p><p className={styles.small}>Moneda: {record.currency || 'No informada'}</p><div className={styles.budget}><div><span>Desde</span><strong>{amount(record.budget_min)}</strong></div><span aria-hidden="true">—</span><div><span>Hasta</span><strong>{amount(record.budget_max)}</strong></div></div></div>
        <div className={styles.rooms}><p className={styles.muted}>Ambientes mínimos</p><strong>{record.min_rooms ?? 'No informado'}</strong></div>
      </div>
      <div className={styles.notes}><strong>Observaciones</strong><p>{record.notes || 'Sin observaciones'}</p></div>
    </section>
    <section className={styles.comparison} aria-labelledby="client-comparison-title">
      <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>Cruce por criterios</p><h2 id="client-comparison-title">Propiedades para comparar</h2><p className={styles.muted}>Contrastá cada opción con la búsqueda antes de ofrecerla.</p></div><div>{aiAction}</div></header>
      {matches.length ? <div className={styles.tableWrap}><table className={styles.matchTable}>
        <caption className={styles.srOnly}>Comparación de propiedades por los criterios aplicables de esta búsqueda.</caption>
        <thead><tr><th scope="col">Propiedad / referencia</th>{columns.map(c => <th scope="col" key={c.key}>{c.label}</th>)}<th scope="col"><span className={styles.srOnly}>Acceso</span></th></tr></thead>
        <tbody>{matches.map(({ item: property, match }) => <tr key={property.id}>
          <th scope="row"><h3>{property.name}</h3><p>{property.price != null ? `${property.currency || ''} ${property.price.toLocaleString('es-AR')}` : 'Sin precio'}{property.surface_total_m2 != null ? <span className={styles.muted}> · {property.surface_total_m2} m²</span> : null}</p><small>{match.coincidencias} de {match.aplicables} criterios aplicables</small></th>
          {columns.map(column => { const criterion = match.criterios.find(c => c.key === column.key); return <td key={column.key} data-criterion={column.key}><span className={styles.mobileCriterion}>{column.label}</span>{criterion?.aplica ? <MatchStatus meets={criterion.cumple} /> : <span className={styles.muted} aria-label={`${column.label}: no aplica`}>—</span>}</td>; })}
          <td className={styles.propertyAccess}><Link href={`/propiedades/${property.id}`} className={styles.action}>Ver propiedad<ArrowRight size={16} aria-hidden="true" /></Link></td>
        </tr>)}</tbody>
      </table></div> : <div className={styles.empty}><h3>No hay propiedades disponibles</h3><p>No hay propiedades disponibles para cruzar todavía. Los datos de búsqueda se conservan arriba.</p></div>}
      <p className={styles.footnote}>Cruce por tipo, presupuesto/moneda, ambientes y zona. Provincia, subzona e interés se muestran como contexto; no se agregan al cálculo. Los criterios no especificados se indican con — y no cuentan como incumplimientos. No es una recomendación de IA.</p>
    </section>
  </>;
}
