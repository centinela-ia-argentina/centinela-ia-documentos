import type { ReactNode } from 'react';
import type { ValueState } from './documentReportData';
import styles from './DocumentReport.module.css';

/**
 * Primitivas de presentación del reporte Documentos e IA.
 * Reglas: un guion (—) nunca significa cero; un fallo de consulta no se
 * presenta como vacío ni como "todo en orden".
 */

export function valueOrDash(state: ValueState<number>): string {
  return state.ok ? String(state.value) : '—';
}

export function percentageOrDash(state: ValueState<number>, total: ValueState<number>): string {
  if (!state.ok || !total.ok) return '—';
  if (total.value <= 0) return '0%';
  return `${Math.round((state.value / total.value) * 100)}%`;
}

export function ReportSection({
  eyebrow,
  title,
  copy,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p className={styles.sectionCopy} style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.065em', fontSize: 10 }}>
            {eyebrow}
          </p>
          <h3 className={styles.sectionTitle} style={{ marginTop: 6, fontSize: 19 }}>{title}</h3>
          <p className={styles.sectionCopy} style={{ marginTop: 4 }}>{copy}</p>
        </div>
        {actions}
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  helper,
  toneClass,
}: {
  label: string;
  value: string;
  helper?: string;
  toneClass?: string;
}) {
  return (
    <div className={`${styles.tile} ${toneClass ?? ''}`}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      {helper ? <p className={styles.tileHelper}>{helper}</p> : null}
    </div>
  );
}

export function BarRow({
  label,
  value,
  total,
  fillClass,
}: {
  label: string;
  value: ValueState<number>;
  total: ValueState<number>;
  fillClass: string;
}) {
  const width =
    value.ok && total.ok && total.value > 0
      ? `${Math.max(0, Math.min(100, Math.round((value.value / total.value) * 100)))}%`
      : '0%';

  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack} role="presentation">
        <div className={`${styles.barFill} ${fillClass}`} style={{ width }} />
      </div>
      <span className={styles.barValue}>
        {valueOrDash(value)} · {percentageOrDash(value, total)}
      </span>
    </div>
  );
}

export function StateBanner({ kind, children }: { kind: 'error' | 'partial' | 'empty'; children: ReactNode }) {
  const className =
    kind === 'error' ? styles.stateError : kind === 'partial' ? styles.statePartial : styles.stateEmpty;

  return (
    <div className={`${styles.stateBanner} ${className}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <StateBanner kind="empty">{message}</StateBanner>;
}

export function ErrorState({ message }: { message: string }) {
  return <StateBanner kind="error">{message}</StateBanner>;
}

export function PartialState({ message }: { message: string }) {
  return <StateBanner kind="partial">{message}</StateBanner>;
}
