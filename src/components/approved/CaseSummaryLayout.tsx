import type { ReactNode } from 'react';
import styles from './ApprovedDetail.module.css';

export function CaseSummaryLayout({ facts, summary, dates, agent, children }: {
  facts: ReactNode; summary: ReactNode; dates: ReactNode; agent: ReactNode; children: ReactNode;
}) {
  return <div className={styles.summaryLayout}>
    <aside className={styles.facts} aria-label="Datos del registro">{facts}</aside>
    <div className={styles.work}>
      <div className={styles.priority}><section className={styles.savedSummary} aria-label="Resumen guardado">{summary}</section><section className={styles.dates} aria-label="Fechas del registro">{dates}</section></div>
      {agent}
      <section className={styles.tools} aria-label="Herramientas del registro"><p className={styles.eyebrow}>Herramientas del rubro</p><h2>Continuar el trabajo</h2>{children}</section>
    </div>
  </div>;
}
