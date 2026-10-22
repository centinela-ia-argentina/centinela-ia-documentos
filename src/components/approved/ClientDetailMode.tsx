'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Pencil, ArrowLeft } from 'lucide-react';
import styles from './ApprovedDetail.module.css';

/** Explicit read/edit modes. Both remain mounted so a cancelled view does not
 * silently discard a draft or recreate the server-action form. */
export function ClientDetailMode({ name, identity, canManage, children, editForm }: {
  name: string; identity: ReactNode; canManage: boolean; children: ReactNode; editForm: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  function openEdit() {
    setEditing(true);
    requestAnimationFrame(() => editor.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus());
  }
  function closeEdit() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }
  return (
    <section className={styles.clientPage} aria-label={`Ficha de ${name}`}>
      <div hidden={editing}>
        <header className={styles.recordHeader}>
          {identity}
          {canManage && <button ref={editButton} type="button" className={styles.action} onClick={openEdit}><Pencil size={16} aria-hidden="true" />Editar cliente</button>}
        </header>
        {children}
      </div>
      {canManage && <div hidden={!editing} ref={editor} className={styles.editor}>
        <button type="button" className={styles.action} onClick={closeEdit}><ArrowLeft size={16} aria-hidden="true" />Volver a la ficha</button>
        <p className={styles.eyebrow}>Ficha de cliente</p>
        <h1>Editar cliente</h1><p className={styles.muted}>{name} · Revisá el contacto y los criterios de búsqueda.</p>
        {editForm}
        <button type="button" className={styles.action} onClick={closeEdit}>Cancelar</button>
      </div>}
    </section>
  );
}
