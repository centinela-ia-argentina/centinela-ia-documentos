'use client';
import {useRef,useState,type ReactNode} from 'react';
import {Pencil,ArrowLeft} from 'lucide-react';
import styles from './Rentals.module.css';
export function RentalDetailMode({canManage,readView,editForm}:{canManage:boolean;readView:ReactNode;editForm:ReactNode}) {
 const [editing,setEditing]=useState(false);const button=useRef<HTMLButtonElement>(null),editor=useRef<HTMLDivElement>(null);
 function close(){setEditing(false);requestAnimationFrame(()=>button.current?.focus())}
 return <div><div hidden={editing}>{canManage&&<button type="button" ref={button} className={styles.btn} onClick={()=>{setEditing(true);requestAnimationFrame(()=>editor.current?.querySelector<HTMLInputElement>('input:not([type=hidden])')?.focus())}}><Pencil size={16} aria-hidden/>Editar contrato</button>}<div className={styles.formSpacer}>{readView}</div></div>{canManage&&<div hidden={!editing} ref={editor}><button type="button" className={styles.backBtn} onClick={close}><ArrowLeft size={16} aria-hidden/>Volver al contrato</button><h2 className={styles.editorTitle}>Editar contrato</h2><p className={styles.scope}>Modificá los datos técnicos, montos e índices.</p>{editForm}<button type="button" className={styles.btn} onClick={close}>Cancelar</button></div>}</div>;
}
