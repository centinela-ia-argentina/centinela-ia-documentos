 'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { parseRentalDate, rentalDateISO } from '@/lib/rentals/calendar';
import styles from './ApprovedForm.module.css';
export function dateTextToISO(value:string):string {if(!/^\d{2}\/\d{2}\/\d{4}$/.test(value))return '';const iso=value.split('/').reverse().join('-');return rentalDateISO(parseRentalDate(iso))??'';}
export function CivilDateField({name,id,label,defaultValue='',required=false}:{name:string;id:string;label:string;defaultValue?:string;required?:boolean}) {
 const [text,setText]=useState(defaultValue?defaultValue.split('-').reverse().join('/'):'');const input=useRef<HTMLInputElement>(null),picker=useRef<HTMLInputElement>(null);const iso=dateTextToISO(text);
 useEffect(()=>{input.current?.setCustomValidity(text&&!iso?'Ingresá una fecha válida con formato dd/mm/aaaa.':'');},[text,iso]);
 return <div className={styles.ncDate}><input ref={input} id={id} type="text" inputMode="numeric" placeholder="dd/mm/aaaa" value={text} onChange={e=>setText(e.target.value)} required={required} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" aria-describedby={`${id}-format`}/><input type="hidden" name={name} value={iso}/><button className={styles.ncDateButton} type="button" aria-label={`Elegir ${label.toLowerCase()}`} onClick={()=>{try{if(picker.current?.showPicker)picker.current.showPicker();else input.current?.focus();}catch{input.current?.focus();}}}><CalendarDays size={18} aria-hidden/></button><input ref={picker} type="date" className={styles.ncNativeDate} value={iso} onChange={e=>setText(e.target.value?e.target.value.split('-').reverse().join('/'):'')} aria-hidden tabIndex={-1}/><span className="sr-only" id={`${id}-format`}>Formato día/mes/año.</span></div>;
}
