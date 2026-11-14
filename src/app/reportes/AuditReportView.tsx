import Link from 'next/link';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import type { AuditReportData, AuditReportFilter } from './auditReportContract';
import type { AuditCaseRecord, AuditDocumentRecord } from './auditPresentation';
import { formatAuditActionLabel } from '@/lib/audit/actionLabels';
import {
  actionDotTone,
  formatAuditDate,
  getActorLabel,
  getActorRole,
  getAuditDetail,
  getResourceLabel,
} from './auditPresentation';
import styles from './AuditReport.module.css';

/**
 * Vista del centro de auditoría. Recibe datos ya construidos:
 * - Un conteo fallido se muestra como "—" (no como cero).
 * - Una página de eventos fallida se muestra como error, no como tabla vacía.
 * - Un fallo de perfiles no elimina ni inventa identidades.
 */

const COUNT_TILES: Array<{ key: 'todos' | 'documentos' | 'ia' | 'expedientes' | 'invitaciones'; label: string }> = [
  { key: 'todos', label: 'Eventos auditados' },
  { key: 'documentos', label: 'Eventos documentales' },
  { key: 'ia', label: 'Eventos IA' },
  { key: 'expedientes', label: 'Eventos de expedientes' },
  { key: 'invitaciones', label: 'Invitaciones' },
];

function countText(value: { ok: boolean; value?: number }) {
  return value.ok ? String(value.value) : '—';
}

export function AuditReportView({
  data,
  activeFilter,
  filters,
  terms,
  documentsById,
  casesById,
  profilesById,
  prevHref,
  nextHref,
}: {
  data: AuditReportData;
  activeFilter: AuditReportFilter;
  filters: Array<{ label: string; value: AuditReportFilter; href: string; count: { ok: boolean; value?: number } }>;
  terms: IndustryTerms;
  documentsById: Map<string, AuditDocumentRecord>;
  casesById: Map<string, AuditCaseRecord>;
  profilesById: Map<string, { id: string; full_name?: string | null; email?: string | null; role?: string | null }>;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const { counts, logs, profiles, page, totalFiltered, totalPages } = data;
  const rows = logs.ok ? logs.value : [];

  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>Trazabilidad</p>
      <h3 className={styles.title}>Centro de auditoría operativa</h3>
      <p className={styles.copy}>
        Control de acciones registradas por usuario, recurso, evento y fecha. Acceso restringido a administradores y auditores.
      </p>

      <div className={styles.gridCounts}>
        {COUNT_TILES.map((tile) => (
          <div key={tile.key} className={styles.countTile}>
            <p className={styles.countLabel}>{tile.label}</p>
            <p className={styles.countValue}>{countText(counts[tile.key])}</p>
          </div>
        ))}
      </div>

      {!logs.ok ? (
        <div className={`${styles.stateBanner} ${styles.stateError}`} role="alert">
          No se pudieron consultar los eventos de esta página. El listado no se presenta como vacío hasta confirmar el estado real de la consulta.
        </div>
      ) : rows.length === 0 ? (
        <div className={`${styles.stateBanner} ${styles.stateEmpty}`} role="status">
          No hay eventos para este filtro de auditoría.
        </div>
      ) : null}

      <nav className={styles.filters} aria-label="Filtros de auditoría">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.href}
            className={`${styles.filterChip} ${activeFilter === filter.value ? styles.filterChipActive : ''}`}
            aria-current={activeFilter === filter.value ? 'page' : undefined}
          >
            {filter.label} · {countText(filter.count)}
          </Link>
        ))}
      </nav>

      {logs.ok ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>Evento</th>
                <th>Usuario</th>
                <th>Recurso</th>
                <th>Detalle</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className={styles.actionCell}>
                      <span className={`${styles.dot} ${actionDotTone(log.action)}`} aria-hidden="true" />
                      {formatAuditActionLabel(log.action, terms)}
                    </span>
                  </td>
                  <td>
                    <p className={styles.actorName}>{getActorLabel(log, profilesById)}</p>
                    <p className={styles.actorRole}>{getActorRole(log, profilesById)}</p>
                  </td>
                  <td>{getResourceLabel(log, documentsById, casesById, terms)}</td>
                  <td className={styles.detailCell}>{getAuditDetail(log)}</td>
                  <td className={styles.dateCell}>{formatAuditDate(log.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyRow} colSpan={5}>
                    No hay eventos para este filtro de auditoría.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {profiles.ok ? null : rows.length > 0 ? (
        <p className={styles.copy} style={{ marginTop: 10 }}>
          Algunos usuarios de esta página no pudieron confirmarse; se muestran sus identificadores parciales en lugar de identidades inventadas.
        </p>
      ) : null}

      {totalFiltered.ok && totalPages > 1 ? (
        <div className={styles.pagination}>
          <span>
            Página {page} de {totalPages} · {totalFiltered.value} eventos en este filtro
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {page > 1 && prevHref ? (
              <Link className={styles.pageButton} href={prevHref}>
                ← Anterior
              </Link>
            ) : (
              <span className={`${styles.pageButton} ${styles.pageButtonDisabled}`}>← Anterior</span>
            )}
            {page < totalPages && nextHref ? (
              <Link className={styles.pageButton} href={nextHref}>
                Siguiente →
              </Link>
            ) : (
              <span className={`${styles.pageButton} ${styles.pageButtonDisabled}`}>Siguiente →</span>
            )}
          </span>
        </div>
      ) : null}
    </section>
  );
}
