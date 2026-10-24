'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/AppButton';
import styles from './RecordDialog.module.css';

/** Dialog de acciones: foco nativo, Escape, cierre exterior y retorno al disparador. */
export function RecordDialog({ trigger, triggerLabel, title, children, compact = false }: { trigger: ReactNode; triggerLabel?: string; title: string; children: ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  return <>
    <span ref={triggerRef} className={styles.trigger}>
      <AppButton variant="secondary" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className={compact ? styles.compact : undefined}>{trigger}</AppButton>
    </span>
    {open ? <OpenDialog titleId={id} onClose={() => setOpen(false)} onRestoreFocus={() => triggerRef.current?.querySelector('button')?.focus()}>
      <header className={styles.head}><h2 id={id}>{title}</h2><AppButton variant="secondary" aria-label="Cerrar acciones" onClick={() => setOpen(false)} className={styles.compact}><X size={18} aria-hidden /></AppButton></header>
      <div className={styles.body}>{children}</div>
    </OpenDialog> : null}
  </>;
}
function OpenDialog({ titleId, children, onClose, onRestoreFocus }: { titleId:string; children:ReactNode; onClose:()=>void; onRestoreFocus:()=>void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); onRestoreFocus(); };
    // Mount/unmount only: dialog contents may update without reopening or moving focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} tabIndex={-1} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>{children}</dialog>;
}
