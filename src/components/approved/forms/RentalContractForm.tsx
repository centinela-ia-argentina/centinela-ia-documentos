import Link from 'next/link';
import type {RentalContract} from '@/types/rental';
import {FormSubmitButton} from '@/components/ui/FormSubmitButton';
import {SelectField} from '@/components/ui/SelectField';
import {FormField,FormSection,type FormAction} from './FormParts';
import {CivilDateField} from './CivilDateField';
import styles from './ApprovedForm.module.css';
export function RentalContractForm({action,properties,record}:{action:FormAction;properties:{id:string;name:string}[];record?:RentalContract}) {
 const prefix=record?`rental-${record.id}`:'new-rental';const id=(name:string)=>`${prefix}-${name}`;
 return <div className={styles.root}><form action={action} className={styles.ncPanel} aria-label={record?'Editar contrato':'Nuevo contrato'}>{record&&<input type="hidden" name="rental_id" value={record.id}/>}<div className={styles.ncIntro}><p>Completá las condiciones para el seguimiento del alquiler.</p><span className={styles.ncTag}>* Campos obligatorios</span></div>
 <FormSection number="01" title="Datos principales" description="Identificá la propiedad y el inquilino del contrato.">
 <FormField id={id('property_id')} label="Propiedad · opcional"><SelectField name="property_id" label="Propiedad · opcional" defaultValue={record?.property_id||''} options={properties.map(p=>({value:p.id,label:p.name}))} placeholder="Sin propiedad vinculada"/></FormField>
 <FormField id={id('tenant_name')} label="Inquilino"><input id={id('tenant_name')} name="tenant_name" type="text" defaultValue={record?.tenant_name||''} placeholder="Nombre y apellido"/></FormField>
 <FormField id={id('base_amount')} label="Monto inicial del alquiler *" help="Usá coma para decimales (ej: 4,5)"><input id={id('base_amount')} name="base_amount" type="text" inputMode="decimal" defaultValue={record?.base_amount||''} required placeholder="Ej. 350000" aria-describedby={`${id('base_amount')}-help`}/></FormField>
 <FormField id={id('currency')} label="Moneda"><SelectField name="currency" label="Moneda" defaultValue={record?.currency||'ARS'} options={[{value:'ARS',label:'ARS ($)'},{value:'USD',label:'USD (u$s)'}]} placeholder="Seleccionar"/></FormField>
 </FormSection>
 <FormSection number="02" title="Condiciones de ajuste" description="Definí el índice y la frecuencia previstos en el contrato." three>
 <FormField id={id('index_type')} label="Índice de ajuste"><SelectField name="index_type" label="Índice de ajuste" defaultValue={record?.index_type||'ICL'} options={[{value:'ICL',label:'ICL (BCRA)'},{value:'IPC',label:'IPC (INDEC)'},{value:'CASA_PROPIA',label:'Casa Propia'},{value:'FIJO',label:'Porcentaje fijo'}]} placeholder="Seleccionar"/></FormField>
 <FormField id={id('fixed_pct')} label="% por período (si es fijo)" help="Solo para porcentaje fijo. Usá coma para decimales (ej: 4,5)."><input id={id('fixed_pct')} name="fixed_pct" type="text" inputMode="decimal" defaultValue={record?.fixed_pct||''} placeholder="4,5" aria-describedby={`${id('fixed_pct')}-help`}/></FormField>
 <FormField id={id('adjustment_period_months')} label="Periodicidad de ajuste (meses)"><SelectField name="adjustment_period_months" label="Periodicidad de ajuste (meses)" defaultValue={record?(record.adjustment_period_months?.toString()||'12'):'3'} options={[{value:'3',label:'Cada 3 meses (Trimestral)'},{value:'4',label:'Cada 4 meses (Cuatrimestral)'},{value:'6',label:'Cada 6 meses (Semestral)'},{value:'12',label:'Cada 12 meses (Anual)'}]} placeholder="Seleccionar"/></FormField>
 </FormSection>
 <FormSection number="03" title="Fechas y estado" description="Registrá el inicio y, si corresponde, el último ajuste." three>
 <FormField id={id('start_date')} label="Inicio del contrato *"><CivilDateField id={id('start_date')} name="start_date" label="inicio del contrato" required defaultValue={record?.start_date?record.start_date.split('T')[0]:''}/></FormField>
 <FormField id={id('last_adjustment_date')} label="Último ajuste (si ya tuvo)"><CivilDateField id={id('last_adjustment_date')} name="last_adjustment_date" label="último ajuste" defaultValue={record?.last_adjustment_date?record.last_adjustment_date.split('T')[0]:''}/></FormField>
 <FormField id={id('status')} label="Estado"><SelectField name="status" label="Estado" defaultValue={record?.status||'vigente'} options={[{value:'vigente',label:'Vigente'},{value:'finalizado',label:'Finalizado'}]} placeholder="Seleccionar"/></FormField>
 <FormField id={id('notes')} label="Observaciones" wide><textarea id={id('notes')} name="notes" rows={4} defaultValue={record?.notes||''} placeholder="Información adicional sobre el contrato..."/></FormField>
 </FormSection><footer className={styles.ncFooter}><p>Este registro permite seguir el alquiler. No genera un documento contractual ni aplica ajustes.</p><div className={styles.actionRow}>{!record&&<Link href="/alquileres" className={styles.btn}>Cancelar</Link>}<FormSubmitButton label={record?'Guardar cambios':'Guardar contrato'} loadingLabel="Guardando..."/></div></footer></form></div>;
}
