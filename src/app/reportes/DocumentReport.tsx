import type { IndustryTerms } from '@/lib/industries/uiLabels';
import type { DocumentReportData } from './documentReportData';
import {
  BarRow,
  EmptyState,
  ErrorState,
  MetricTile,
  PartialState,
  ReportSection,
  valueOrDash,
} from './DocumentReportView';
import styles from './DocumentReport.module.css';

/**
 * Reporte "Documentos e IA" — presentación de los datos construidos por
 * documentReportData. No ejecuta consultas ni modifica estados.
 */

const SENSITIVITY_LABELS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Crítico',
};

const SENSITIVITY_TONES: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: '#4b8a5a',
  medium: '#3d6f92',
  high: '#a3762a',
  critical: '#a4413f',
};

const EXPIRY_TILES: Array<{
  key: 'vencido' | 'porVencer' | 'vigente' | 'sinVencimiento';
  label: string;
  helper: string;
  toneClass: string;
}> = [
  { key: 'vencido', label: 'Vencidos', helper: 'Documentos expirados', toneClass: styles.expired },
  { key: 'porVencer', label: 'Por vencer', helper: 'Próximos 30 días', toneClass: styles.expiring },
  { key: 'vigente', label: 'Vigentes', helper: 'En regla', toneClass: styles.valid },
  { key: 'sinVencimiento', label: 'Sin fecha', helper: 'No aplica o no cargada', toneClass: styles.noExpiry },
];

export function DocumentReport({
  data,
  terms,
}: {
  data: DocumentReportData;
  terms: IndustryTerms;
}) {
  const { counts, sensitivity, expiry, status, failedDependencies } = data;

  const isEmpty = counts.total.ok && counts.total.value === 0;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {status === 'unavailable' ? (
        <ErrorState
          message={`No se pudieron consultar los datos de documentos${failedDependencies.length > 0 ? ` (${failedDependencies.join(', ')})` : ''}. El resultado no se presenta como cero ni como vacío hasta confirmar el estado real.`}
        />
      ) : null}

      {status === 'partial' ? (
        <PartialState message="Datos parciales: algunas consultas no respondieron y las secciones afectadas se muestran como no disponibles." />
      ) : null}

      {isEmpty && status === 'ok' ? (
        <EmptyState message="Todavía no hay documentos cargados en la organización. Cuando haya documentos, este reporte mostrará cobertura de análisis, sensibilidad y vencimientos." />
      ) : null}

      {!isEmpty ? (
        <>
          <ReportSection
            eyebrow="Cobertura IA"
            title="Estado del análisis documental"
            copy="Medición de documentos analizados y pendientes en entorno controlado."
            actions={
              counts.coveragePct.ok ? (
                <span className={styles.coveragePill}>{counts.coveragePct.value}%</span>
              ) : (
                <span className={styles.unknownPill}>—</span>
              )
            }
          >
            <div className={styles.gridFour}>
              <MetricTile label="Documentos totales" value={valueOrDash(counts.total)} />
              <MetricTile label="Analizados" value={valueOrDash(counts.analyzed)} />
              <MetricTile label="Pendientes" value={valueOrDash(counts.pending)} />
              <MetricTile label="Cobertura IA" value={counts.coveragePct.ok ? `${counts.coveragePct.value}%` : '—'} />
            </div>
          </ReportSection>

          <ReportSection
            eyebrow="Sensibilidad"
            title="Distribución documental"
            copy="Clasificación de documentos según sensibilidad asignada."
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {(['critical', 'high', 'medium', 'low'] as const).map((key) => (
                <BarRow
                  key={key}
                  label={SENSITIVITY_LABELS[key]}
                  value={sensitivity[key]}
                  total={counts.total}
                  fillClass=""
                />
              ))}
            </div>
          </ReportSection>

          <ReportSection
            eyebrow="Vencimientos"
            title="Estado actual de las vigencias documentales"
            copy="Seguimiento de documentos vigentes, por vencer y vencidos en entorno controlado."
          >
            <div className={styles.gridFour}>
              {EXPIRY_TILES.map((tile) => (
                <MetricTile
                  key={tile.key}
                  label={tile.label}
                  value={valueOrDash(expiry[tile.key])}
                  helper={tile.helper}
                  toneClass={tile.toneClass}
                />
              ))}
            </div>
          </ReportSection>

          <p className={styles.legacyNote}>
            Los plazos derivados del análisis documental son referenciales y no reemplazan la revisión profesional.
          </p>
        </>
      ) : null}
    </div>
  );
}
