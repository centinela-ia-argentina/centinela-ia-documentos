'use client';

import { useId, useState, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import styles from './IndustryTools.module.css';

/** Sección plegable de las herramientas del registro (patrón "Consultar al agente").
 * El contenido permanece montado al plegarse: borradores, formularios y estados no se pierden. */
export function CollapseArea({ openLabel, closeLabel, hint, children }: {
  openLabel: string; closeLabel?: string; hint?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <>
    <button type="button" className={styles.disclosure} aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(v => !v)}>
      <span className={styles.disclosureLabel}>{open ? (closeLabel || openLabel) : openLabel}</span>
      {hint ? <span className={styles.disclosureHint}>{hint}</span> : null}
      <CaretDown size={14} weight="bold" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
    </button>
    <div id={id} hidden={!open} className={styles.disclosureBody}>{children}</div>
  </>;
}
