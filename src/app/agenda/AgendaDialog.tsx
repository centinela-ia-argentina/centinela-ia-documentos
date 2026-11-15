'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Agenda.module.css';
export function AgendaDialog({children,onClose,labelledById}: {children:ReactNode;onClose:()=>void;labelledById?:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog=ref.current;const opener=document.activeElement;
    if(dialog && !dialog.open) dialog.showModal();
    return () => {if(dialog?.open) dialog.close(); if(opener instanceof HTMLElement && opener.isConnected) opener.focus();};
  },[]);
  return <dialog ref={ref} className={styles.eventDetail} aria-labelledby={labelledById}
    onCancel={event => {event.preventDefault();onClose();}}
    onClick={event => {if(event.target === event.currentTarget){const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)onClose();}}}>
    {children}
  </dialog>;
}
