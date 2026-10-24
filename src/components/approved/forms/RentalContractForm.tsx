import Link from 'next/link';
import type {RentalContract} from '@/types/rental';
import {FormSubmitButton} from '@/components/ui/FormSubmitButton';
import {FormField,FormSection,type FormAction} from './FormParts';
import {CivilDateField} from './CivilDateField';
import styles from './ApprovedForm.module.css';
export function RentalContractForm({action,properties,record}:{action:FormAction;properties:{id:string;name:string}[];record?:RentalContract}) {
 const prefix=record?`rental-${record.id}`:'new-rental';const id=(name:string)=>`${prefix}-${name}`;
 return <div className={styles.root}><form action={action} className={styles.ncPanel} aria-label={record?'Editar contrato':'Nuevo contrato'}>{record&&<input type="hidden" name="rental_id" value={record.id}/>}<div className={styles.ncIntro}><p>Completá las condiciones para el seguimiento del alquiler.</p><span className={styles.ncTag}>* Campos obligatorios</span></div>
 <FormSection number="01" title="Datos principales" description="Identificá la propiedad y el inquilino del contrato.">
 <FormField id={id('property_id')} label="Propiedad · opcional"><select id={id('property_id')} name="property_id" defaultValue={record?.property_id||''}><option value="">Sin propiedad vinculada</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
 <FormField id={id('tenant_name')} label="Inquilino"><input id={id('tenant_name')} name="tenant_name" type="text" defaultValue={record?.tenant_name||''} placeholder="Nombre y apellido"/></FormField>
 <FormField id={id('base_amount')} label="Monto inicial del alquiler *" help="Usá coma para decimales (ej: 4,5)"><input id={id('base_amount')} name="base_amount" type="text" inputMode="decimal" defaultValue={record?.base_amount||''} required placeholder="Ej. 350000" aria-describedby={`${id('base_amount')}-help`}/></FormField>
 <FormField id={id('currency')} label="Moneda"><select id={id('currency')} name="currency" defaultValue={record?.currency||'ARS'}><option value="ARS">ARS ($)</option><option value="USD">USD (u$s)</option></select></FormField>
 </FormSection>
 <FormSection number="02" title="Condiciones de ajuste" description="Definí el índice y la frecuencia previstos en el contrato." three>
 <FormField id={id('index_type')} label="Índice de ajuste"><select id={id('index_type')} name="index_type" defaultValue={record?.index_type||'ICL'}><option value="ICL">ICL (BCRA)</option><option value="IPC">IPC (INDEC)</option><option value="CASA_PROPIA">Casa Propia</option><option value="FIJO">Porcentaje fijo</option></select></FormField>
 <FormField id={id('fixed_pct')} label="% por período (si es fijo)" help="Solo para porcentaje fijo. Usá coma para decimales (ej: 4,5)."><input id={id('fixed_pct')} name="fixed_pct" type="text" inputMode="decimal" defaultValue={record?.fixed_pct||''} placeholder="4,5" aria-describedby={`${id('fixed_pct')}-help`}/></FormField>
 <FormField id={id('adjustment_period_months')} label="Periodicidad de ajuste (meses)"><select id={id('adjustment_period_months')} name="adjustment_period_months" defaultValue={record?(record.adjustment_period_months?.toString()||'12'):'3'}><option value="3">Cada 3 meses (Trimestral)</option><option value="4">Cada 4 meses (Cuatrimestral)</option><option value="6">Cada 6 meses (Semestral)</option><option value="12">Cada 12 meses (Anual)</option></select></FormField>
 </FormSection>
 <FormSection number="03" title="Fechas y estado" description="Registrá el inicio y, si corresponde, el último ajuste." three>
 <FormField id={id('start_date')} label="Inicio del contrato *"><CivilDateField id={id('start_date')} name="start_date" label="inicio del contrato" required defaultValue={record?.start_date?record.start_date.split('T')[0]:''}/></FormField>
 <FormField id={id('last_adjustment_date')} label="Último ajuste (si ya tuvo)"><CivilDateField id={id('last_adjustment_date')} name="last_adjustment_date" label="último ajuste" defaultValue={record?.last_adjustment_date?record.last_adjustment_date.split('T')[0]:''}/></FormField>
 <FormField id={id('status')} label="Estado"><select id={id('status')} name="status" defaultValue={record?.status||'vigente'}><option value="vigente">Vigente</option><option value="finalizado">Finalizado</option></select></FormField>
 <FormField id={id('notes')} label="Observaciones" wide><textarea id={id('notes')} name="notes" rows={4} defaultValue={record?.notes||''} placeholder="Información adicional sobre el contrato..."/></FormField>
 </FormSection><footer className={styles.ncFooter}><p>Este registro permite seguir el alquiler. No genera un documento contractual ni aplica ajustes.</p><div className={styles.actionRow}>{!record&&<Link href="/alquileres" className={styles.btn}>Cancelar</Link>}<FormSubmitButton label={record?'Guardar cambios':'Guardar contrato'} loadingLabel="Guardando..."/></div></footer></form></div>;
}
