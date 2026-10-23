import Link from 'next/link';
import { FileText, UploadSimple, Tray, ShieldWarning } from '@phosphor-icons/react/dist/ssr';
import { canUploadDocument, canDeleteDocument, type UserRole } from '@/lib/permissions/roles';
import { getDocumentTypeLabel, normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { PreguntarDocumentos } from './PreguntarDocumentos';
import { EliminarDocumentoButton } from './EliminarDocumentoButton';
import styles from './CaseDocuments.module.css';
export type CaseDocumentRow = {id:string;file_name:string;document_type:string|null;sensitivity_level:string|null;created_at:string;contributed_by_organization_id:string|null;contributed_by_name:string|null};
export type CaseDocumentNote = {id:string;body:string;author_org_name:string|null;created_at:string};
export function CaseDocumentsPanel({caseId,industry,role,puedeUsarIA,documents,notes}:{caseId:string;industry:string;role:UserRole;puedeUsarIA:boolean;documents:CaseDocumentRow[];notes:CaseDocumentNote[]}) {
 const terms=getIndustryTerms(normalizeIndustryType(industry));
 return <section className={styles.panel} aria-label="Documentos del registro">
  <header className={styles.header}><div><h2>{terms.docsTitulo}</h2><p>{terms.docsSubtitulo}</p></div>{canUploadDocument(role)&&<Link className={styles.action} href={`/documentos/subir?case=${caseId}`}><UploadSimple size={18} aria-hidden="true"/>Subir documento</Link>}</header>
  <div className={styles.bar}><span>{documents.length} {documents.length===1?'documento':'documentos'}</span><span>Más recientes primero</span></div>
  {documents.length>0?<><div className={styles.columns} aria-hidden="true"><span>Documento</span><span>Sensibilidad</span><span>Acciones</span></div><ul className={styles.list} aria-label="Archivos asociados">{documents.map(document=>{const sensitivity=sensitivityLabel(document.sensitivity_level);return <li key={document.id} className={styles.row}>
   <div className={styles.identity}><FileText size={18} aria-hidden="true"/><div><h3>{document.file_name}</h3><p>{getDocumentTypeLabel(document.document_type)}</p>{document.contributed_by_organization_id&&<p className={styles.contribution}>Aportado por {document.contributed_by_name||'la escribanía'}</p>}</div></div>
   <span className={`${styles.sensitivity} ${sensitivity==='Crítico'||sensitivity==='Alto'?styles.sensitive:''}`}><ShieldWarning size={15} aria-hidden="true"/>{sensitivity}</span>
   <div className={styles.actions}><Link className={styles.action} href={`/documentos/${document.id}`}>Ver documento</Link>{canDeleteDocument(role)&&<EliminarDocumentoButton documentId={document.id} caseId={caseId} fileName={document.file_name}/>}</div>
  </li>})}</ul></>:<div className={styles.empty}><Tray size={24} aria-hidden="true"/><p>{terms.docsVacio}</p></div>}
  <PreguntarDocumentos caseId={caseId} puedeUsarIA={puedeUsarIA} industry={industry}/>
  {notes.length>0&&<section className={styles.notes} aria-label="Observaciones de la escribanía"><h2>Observaciones de la escribanía</h2><p>Notas que dejó la escribanía sobre este legajo.</p><ul>{notes.map(note=><li key={note.id}><p>{note.body}</p><small>{note.author_org_name??'Escribanía'} · {new Date(note.created_at).toLocaleString('es-AR')}</small></li>)}</ul></section>}
 </section>;
}
