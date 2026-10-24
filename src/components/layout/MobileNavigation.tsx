'use client';

import { useRef, type ReactNode } from 'react';
import { List, X } from '@phosphor-icons/react';
import styles from './Shell.module.css';

/** Native modal supplies focus containment and Escape; no separate route tree. */
export function MobileNavigation({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${styles.iconAction} ${styles.mobileTrigger}`}
        aria-label="Abrir navegación"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <List size={18} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className={styles.drawer}
        aria-label="Navegación de Anulus"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if ((event.target as Element).closest('a[href]')) close();
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) close();
          }
        }}
      >
        <div className={styles.drawerHeader}>
          <strong>Navegación</strong>
          <button type="button" className={styles.iconAction} onClick={close} aria-label="Cerrar navegación">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </dialog>
    </>
  );
}