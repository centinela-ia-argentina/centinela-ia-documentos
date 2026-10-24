 'use client';
import { useId, useState, type ReactNode } from 'react';
import { Image, Files, Minimize2, Replace, Type, ChevronRight, ShieldCheck } from 'lucide-react';
import styles from './ToolsWorkspace.module.css';
const catalog = [
 {title:'Imagen → PDF',description:'Fotos o capturas, en un solo PDF.',icon:Image},
 {title:'Unir PDF',description:'Combiná archivos en el orden que elijas.',icon:Files},
 {title:'Comprimir PDF',description:'Reducí el peso de un PDF escaneado.',icon:Minimize2},
 {title:'Convertir imágenes',description:'Formato y tamaño de tus imágenes.',icon:Replace},
 {title:'Utilidades de texto',description:'Montos, conteos, diferencias y fechas.',icon:Type},
];
export function ToolsWorkspace({eyebrow,tools}:{eyebrow:string;tools:ReactNode[]}) {
 const [active,setActive]=useState(0); const id=useId();
 return <div className={styles.root}>
 <header className={styles.toolsHead}><div><p className={styles.catalogLabel}>{eyebrow}</p><h1>Herramientas</h1><p>Prepará tus archivos y textos desde un mismo espacio de trabajo.</p></div><aside className={styles.privacyNote}><ShieldCheck size={20} aria-hidden/><div><strong>Procesamiento local</strong><span>Guardar en Documentos es una acción separada que envía el archivo a tu organización. Comprimir PDF puede descargar un componente externo de PDF.js.</span></div></aside></header>
 <div className={styles.toolsLayout}><nav className={styles.toolCatalog} aria-label="Catálogo de herramientas"><p className={styles.catalogLabel}>ARCHIVOS</p>{catalog.map((tool,index)=><div key={tool.title}>{index===4&&<p className={styles.catalogLabel}>TEXTO</p>}<button type="button" aria-current={active===index?'true':undefined} aria-controls={`${id}-${index}`} onClick={()=>setActive(index)}><tool.icon aria-hidden/><span><strong>{tool.title}</strong><small>{tool.description}</small></span><ChevronRight size={16} aria-hidden/></button></div>)}</nav>
 <section className={styles.toolWorkspace}><header className={styles.workspaceHead}><div><p className={styles.catalogLabel}>HERRAMIENTA SELECCIONADA</p><h2>{catalog[active].title}</h2><p>{catalog[active].description}</p></div></header><div className={styles.workspaceBody}>{tools.map((tool,index)=><div key={index} id={`${id}-${index}`} hidden={active!==index} aria-label={catalog[index].title}>{tool}</div>)}</div></section></div><p className={styles.toolsScope}>Convertir o guardar un archivo no confirma su validez documental ni reemplaza la revisión profesional.</p></div>;
}
