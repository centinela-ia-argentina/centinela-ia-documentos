import { ArrowRight, Buildings, MapPin } from '@phosphor-icons/react/dist/ssr';
import { AppButtonLink } from '@/components/ui/AppButton';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import type { PropertyRecord } from '@/types/property';
import type { RecordFormAction } from './CaseFacts';
import { RecordPendingButton } from './RecordPendingButton';
import styles from './RecordFacts.module.css';

type LinkedPropertyValue = Pick<PropertyRecord, 'id' | 'name' | 'address' | 'status' | 'property_type'>;
type PropertyOption = Pick<PropertyRecord, 'id' | 'name' | 'address'>;
export function LinkedProperty({ caseId, property, properties, canUpdate, linkAction }: {
  caseId: string; property: LinkedPropertyValue | null; properties: PropertyOption[]; canUpdate: boolean; linkAction: RecordFormAction;
}) {
  return <section className={styles.property} aria-label="Propiedad asociada">
    <h3><Buildings size={17} aria-hidden="true" />Propiedad asociada</h3>
    {property ? <div className={styles.propertyRead}>
      <h4>{property.name}</h4>
      <p><MapPin size={16} aria-hidden="true" />{property.address || 'Sin dirección'}</p>
      <div className={styles.propertyStatus}>
        <span className={`${styles.badge} ${property.status === 'disponible' ? styles.success : property.status === 'reservada' ? styles.warning : styles.neutral}`}>{getPropertyStatusLabel(property.status)}</span>
        <span>{getPropertyTypeLabel(property.property_type)}</span>
      </div>
      <AppButtonLink href={`/propiedades/${property.id}`} variant="ghost">Ver ficha<ArrowRight size={16} aria-hidden="true" /></AppButtonLink>
    </div> : <p className={styles.empty}>Sin propiedad asociada.</p>}
    {canUpdate && <form action={linkAction} className={`${styles.form} ${styles.propertyForm}`}>
      <input type="hidden" name="case_id" value={caseId} />
      <div className={styles.field}><label htmlFor={`property-${caseId}`}>Vincular propiedad</label>
        <select id={`property-${caseId}`} name="property_id" defaultValue={property?.id || ''}>
          <option value="">Sin propiedad asociada (desvincular)</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name} {p.address ? `— ${p.address}` : ''}</option>)}
        </select>
      </div>
      <RecordPendingButton label="Guardar propiedad" loadingLabel="Guardando..." />
    </form>}
  </section>;
}
