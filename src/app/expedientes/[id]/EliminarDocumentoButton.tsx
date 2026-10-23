'use client';
import { useRef, useId, useTransition } from 'react';
import { DotsThreeVertical, Trash, X } from '@phosphor-icons/react';
import { deleteDocumentFromCase } from '@/app/documentos/actions';
import styles from './CaseDocuments.module.css';
export function EliminarDocumentoButton({documentId,caseId,fileName}:{documentId:string;caseId:string;fileName:string}) {
 const [isPending,startTransition]=useTransition();
 const dialog=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const cancel=useRef<HTMLButtonElement>(null);
 const id=useId();
 function close(){dialog.current?.close();trigger.current?.focus()}
 const handleClick = () => {
    const formData = new FormData();
    formData.append('document_id', documentId);
    formData.append('case_id', caseId);
    startTransition(() => {
      deleteDocumentFromCase(formData);
    });
 };
 return <>
  <button ref={trigger} type="button" className={styles.iconAction} aria-label={`Opciones de ${fileName}`} aria-haspopup="dialog" onClick={()=>{dialog.current?.showModal();cancel.current?.focus()}}><DotsThreeVertical size={18} aria-hidden="true"/></button>
  <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} aria-describedby={`${id}-warning`} onCancel={event=>{event.preventDefault();close()}}>
   <header><h2 id={id}>Eliminar documento</h2><button type="button" className={styles.iconAction} aria-label="Cerrar confirmación" onClick={close}><X size={18} aria-hidden="true"/></button></header>
   <p>Vas a borrar <span className={styles.filename}>{fileName}</span> de forma permanente:</p>
   <ul><li>Se elimina el archivo y sus análisis de IA</li><li>Se borran sus datos de búsqueda</li><li>Se libera el ítem del checklist que lo tuviera vinculado</li></ul>
   <p id={`${id}-warning`}>Esta acción no se puede deshacer. ¿Continuar?</p>
   <footer><button ref={cancel} type="button" className={styles.secondary} onClick={close}>Cancelar</button><button type="button" className={styles.danger} onClick={handleClick} disabled={isPending}><Trash size={16} aria-hidden="true"/>{isPending?'Eliminando…':'Eliminar permanentemente'}</button></footer>
  </dialog>
 </>;
}
