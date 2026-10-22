'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import styles from './ApprovedDetail.module.css';

/** Do not mount the agent until an explicit open. After activation keep it
 * mounted when collapsed, preserving draft, messages and action statuses. */
export function CaseAgentDisclosure({ canUseAi, children }: { canUseAi: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  if (!canUseAi) return null;
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setActivated(true);
      requestAnimationFrame(() => body.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
    }
  }
  return <section className={styles.agentDisclosure} aria-label="Consulta al agente">
    <button type="button" className={styles.agentToggle} aria-expanded={open} aria-controls={id} onClick={toggle}>
      <span className={styles.agentLabel}><Sparkles size={20} aria-hidden="true" /><span><strong>Consultar al agente</strong><small>Documentos y antecedentes de este registro · IA a demanda</small></span></span>
      <span><span>{open ? 'Cerrar consulta' : 'Abrir consulta'}</span><ChevronDown size={16} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} /></span>
    </button>
    <div id={id} ref={body} hidden={!open} className={styles.agentBody}>{activated ? children : null}</div>
  </section>;
}
