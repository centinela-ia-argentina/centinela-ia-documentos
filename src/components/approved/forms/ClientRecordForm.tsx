import Link from 'next/link';
import type {ClientRecord} from '@/types/client';
import {FormSubmitButton} from '@/components/ui/FormSubmitButton';
import {FormField,FormSection,type FormAction} from './FormParts';
import styles from './ApprovedForm.module.css';
const options = {"client_type": [["comprador", "Comprador"], ["inquilino", "Inquilino"], ["vendedor", "Vendedor"], ["propietario", "Propietario"], ["otro", "Otro"]], "status": [["activo", "Activo"], ["en_seguimiento", "En seguimiento"], ["cerrado", "Cerrado"], ["descartado", "Descartado"]], "operation_interest": [["", "No especificado"], ["compra", "Compra"], ["alquiler", "Alquiler"]], "desired_property_type": [["", "No especificado"], ["casa", "Casa"], ["departamento", "Departamento"], ["lote", "Lote/Terreno"], ["local", "Local"], ["oficina", "Oficina"], ["cochera", "Cochera"], ["cualquiera", "Cualquiera"]], "currency": [["USD", "u$s"], ["ARS", "$ (ARS)"]]};
export function ClientRecordForm({action,record}:{action:FormAction;record?:ClientRecord}) {
 const prefix=record?`client-${record.id}`:'new-client';const id=(name:string)=>`${prefix}-${name}`;
 function select(name:keyof typeof options,label:string,value:string,two=false){return <FormField key={name} id={id(name)} label={label} two={two}><select id={id(name)} name={name} defaultValue={value}>{options[name].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></FormField>}
 function input(name:string,label:string,value:string|number,type='text',placeholder='',two=false,required=false){return <FormField key={name} id={id(name)} label={label} two={two}><input id={id(name)} name={name} type={type} defaultValue={value} placeholder={placeholder} required={required}/></FormField>}
 return <div className={styles.root}><form action={action} className={styles.ncPanel} aria-label={record?'Editar cliente':'Nuevo cliente'}>{record&&<input type="hidden" name="client_id" value={record.id}/>}<div className={styles.ncIntro}><p>Registrá el contacto y, si corresponde, sus criterios de búsqueda.</p><span className={styles.ncTag}>* Campo obligatorio</span></div>
 <FormSection number="01" title="Contacto" description="Nombre, medios de contacto y situación del cliente." three>
 {input('name','Nombre del interesado *',record?.name||'','text','Ej: Juan Pérez',true,true)}
 {select('client_type','Tipo de cliente',record?(record.client_type||''):'comprador')}
 {input('email','Email',record?.email||'','email','juan@ejemplo.com')}
 {input('phone','Teléfono',record?.phone||'','text','+54 9 11 ...')}
 {select('status','Estado',record?.status||'activo')}
 </FormSection>
 <FormSection number="02" title="Qué busca" description="Completá lo que sepas. Podés dejar los criterios sin especificar.">
 {select('operation_interest','Interés',record?.operation_interest||'')}
 {select('desired_property_type','Tipo de propiedad buscada',record?.desired_property_type||'')}
 {input('desired_province','Provincia buscada',record?.desired_province||'','text','Ej: Buenos Aires')}
 {input('desired_city','Localidad / Ciudad buscada',record?.desired_city||'','text','Ej: CABA')}
 {input('desired_neighborhood','Barrio / Zona buscada',record?.desired_neighborhood||'','text','Ej: Palermo')}
 {input('desired_subzone','Subzona buscada (opcional)',record?.desired_subzone||'','text','Ej: Palermo Soho')}
 </FormSection>
 <FormSection number="03" title="Presupuesto y observaciones" description="Importes en la moneda seleccionada; completá solo los límites conocidos." three>
 {select('currency','Moneda',record?.currency||'USD')}
 {input('budget_min','Presupuesto desde',record?.budget_min||'','number','Desde')}
 {input('budget_max','Presupuesto hasta',record?.budget_max||'','number','Hasta')}
 {input('min_rooms','Ambientes mínimos',record?.min_rooms||'','number','Ej: 2')}
 <FormField id={id('notes')} label="Observaciones" two><textarea id={id('notes')} name="notes" rows={3} defaultValue={record?.notes||''} placeholder="Aclaraciones adicionales sobre la búsqueda..."/></FormField>
 </FormSection>
 <footer className={styles.ncFooter}><p>Registrar un cliente no crea un contrato ni inicia acciones de IA, comunicaciones o búsquedas automáticas.</p><div className={styles.actionRow}>{!record&&<Link href="/clientes" className={styles.btn}>Cancelar</Link>}<FormSubmitButton label={record?'Guardar cambios':'Guardar cliente'} loadingLabel="Guardando..."/></div></footer></form></div>;
}
