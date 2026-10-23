import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import styles from './ApprovedForm.module.css';
export type FormAction = (data: FormData) => void | Promise<void>;
export function FormPage({backHref,backLabel,title,eyebrow,description,children}:{backHref:string;backLabel:string;title:string;eyebrow:string;description:string;children:ReactNode}) {return <div className={styles.root}><nav className={styles.crumb} aria-label="Ruta"><Link href={backHref}><ArrowLeft size={16} aria-hidden/>{backLabel}</Link><ChevronRight size={16} aria-hidden/><span>{title}</span></nav><header className={styles.head}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>{children}</div>}
export function FormSection({number,title,description,children,three=false}:{number:string;title:string;description:string;children:ReactNode;three?:boolean}) {return <section className={styles.ncSection}><header className={styles.ncSectionHead}><span className={styles.ncStep}>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header><div className={`${styles.ncGrid} ${three?styles.three:''}`}>{children}</div></section>}
export function FormField({id,label,children,help,wide=false,two=false}:{id:string;label:string;children:ReactNode;help?:string;wide?:boolean;two?:boolean}) {return <div className={`${styles.ncField} ${wide?styles.full:two?styles.two:''}`}><label htmlFor={id}>{label}</label>{children}{help&&<p id={`${id}-help`} className={styles.ncHelp}>{help}</p>}</div>}
