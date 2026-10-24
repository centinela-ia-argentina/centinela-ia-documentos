import { Handshake } from '@phosphor-icons/react/dist/ssr';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import styles from './IndustryTools.module.css';
const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  revocada: 'Revocada',
};


export type DerivationItem={id:string;to_email:string;status:string;created_at?:string};
export function DerivationView({caseId,items,action}:{caseId:string;items:DerivationItem[];action:(data:FormData)=>void|Promise<void>}){
  return (
    <div className={styles.tool}>
      <div>
        <h2 className={styles.title}><Handshake size={18} aria-hidden="true" /> Derivar a Escribanía</h2>
        <p className={styles.description}>
          Enviá esta operación a una escribanía con acceso colaborativo limitado (visualización de antecedentes y carga de documentación complementaria).
        </p>
      </div>

      <form action={action} className={styles.form}>
        <input type="hidden" name="case_id" value={caseId} />
        <div>
          <label htmlFor={`derivar-${caseId}-email`} className={styles.caption}>Email de la escribanía</label>
          <input id={`derivar-${caseId}-email`} name="to_email" type="email" required placeholder="escribania@ejemplo.com"
            className={styles.input} />
        </div>
        <div>
          <label htmlFor={`derivar-${caseId}-mensaje`} className={styles.caption}>Mensaje (opcional)</label>
          <input id={`derivar-${caseId}-mensaje`} name="mensaje" type="text" placeholder="Nota para la escribanía"
            className={styles.input} />
        </div>
        <FormSubmitButton label="Derivar a Escribanía →" loadingLabel="Derivando..." />
      </form>

      {items.length > 0 && (
        <div className={styles.history}>
          <p className={styles.caption}>Derivaciones de esta operación</p>
          <ul className={styles.history}>
            {items.map((d) => (
              <li key={d.id} className={styles.badges}>
                <span className={styles.description}>{d.to_email}</span>
                <span className={styles.badge}>{ESTADO_LABEL[d.status] ?? d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
