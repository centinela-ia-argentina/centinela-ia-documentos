/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaseFacts } from './CaseFacts';
import { LinkedProperty } from './LinkedProperty';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { getCaseFields, getCaseStatuses, getCaseStatusLabel } from '@/lib/industries/caseConfig';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { canUpdateCase } from '@/lib/permissions/roles';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getPropertyStatusLabel } from '@/lib/properties/labels';
const pending=vi.hoisted(()=>({value:false}));
vi.mock('react-dom',async original=>({...await original<typeof import('react-dom')>(),useFormStatus:()=>({pending:pending.value})}));
vi.mock('@/app/whatsappActions',()=>({logWhatsAppAction:vi.fn().mockResolvedValue(undefined)}));
import { logWhatsAppAction } from '@/app/whatsappActions';
const el=React.createElement;
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()});
beforeEach(()=>{vi.clearAllMocks();pending.value=false});
for(const industry of ['inmobiliaria','legal','escribania'] as const){
 const fields=getCaseFields(industry),terms=getIndustryTerms(industry);
 const metadata=Object.fromEntries(fields.map(f=>[f.key,f.type==='select'?f.options?.[0]??'':f.type==='date'?'2020-01-01':`Valor ${f.label}`]));
 const props={caseId:'fake-'+industry,caseType:null,status:'in_review',industry,metadata,visibleFields:fields,fields,statusOptions:getCaseStatuses(industry),labels:{title:terms.datosTitulo,edit:terms.editarDatos,update:terms.actualizarCta},updateAction:vi.fn()};
 describe(`Datos V3 · ${industry}`,()=>{
  it('conserva campos, opciones, valores y nombres del formulario del rubro',()=>{
   const {container}=render(el(CaseFacts,props));const form=container.querySelector('form')!;const data=new FormData(form);
   expect(data.get('case_id')).toBe(props.caseId);expect(data.get('status')).toBe('in_review');
   expect(Array.from(data.keys()).sort()).toEqual(['case_id','status',...fields.map(f=>'case_metadata.'+f.key)].sort());
   expect(data.has('title')).toBe(false);expect(data.has('client_name')).toBe(false);
   for(const f of fields){expect(data.get('case_metadata.'+f.key)).toBe(metadata[f.key]);const field=screen.getByLabelText(f.label,{selector:'input,select'});expect(field.id).not.toBe('');if(f.type==='select')expect(Array.from((field as HTMLSelectElement).options).map(o=>o.value)).toEqual(['',...f.options??[]]);}
   expect(Array.from((screen.getByLabelText('Estado',{selector:'select'}) as HTMLSelectElement).options).map(o=>o.value)).toEqual(getCaseStatuses(industry).map(s=>s.value));
  });
  it('mantiene únicamente los metadatos que la ruta declaró visibles',()=>{
   const {container}=render(el(CaseFacts,{...props,visibleFields:fields.slice(0,1)}));
   expect(container.querySelectorAll('dl>div')).toHaveLength(3);expect(container.querySelector('details')!.open).toBe(false);
   expect(container.querySelectorAll('[name^="case_metadata."]')).toHaveLength(fields.length);
  });
  it('abre inicialmente la edición vacía, sin inventar metadatos',()=>{
   const {container}=render(el(CaseFacts,{...props,metadata:null,visibleFields:[]}));
   expect(container.querySelector('details')!.open).toBe(true);const data=new FormData(container.querySelector('form')!);
   for(const f of fields)expect(data.get('case_metadata.'+f.key)).toBe('');
   expect(container.querySelectorAll('dl>div')).toHaveLength(2);
  });
  it('conserva estado fuera del catálogo recibido de la ruta y no lo traduce al guardar',()=>{
   const options=[{value:'legacy_state',label:'Estado histórico'},...getCaseStatuses(industry)];
   const {container}=render(el(CaseFacts,{...props,status:'legacy_state',statusOptions:options}));
   expect(new FormData(container.querySelector('form')!).get('status')).toBe('legacy_state');
   expect((screen.getByLabelText('Estado',{selector:'select'}) as HTMLSelectElement).options[0].text).toBe('Estado histórico');
  });
  it('retiene el borrador al plegar y renderizar otra vez el mismo registro',()=>{
   const {container,rerender}=render(el(CaseFacts,props));const field=fields.find(f=>f.type==='text')!;
   const input=screen.getByLabelText(field.label,{selector:'input'}) as HTMLInputElement;
   fireEvent.change(input,{target:{value:'Borrador sin guardar'}});const details=container.querySelector('details')!;
   details.open=true;details.open=false;rerender(el(CaseFacts,{...props,metadata:{...metadata,[field.key]:'Valor del servidor'}}));
   expect((screen.getByLabelText(field.label,{selector:'input'}) as HTMLInputElement).value).toBe('Borrador sin guardar');
   expect(props.updateAction).not.toHaveBeenCalled();
  });
  it('remite la misma acción y payload solo al enviar explícitamente',async()=>{
   const action=vi.fn().mockResolvedValue(undefined);const {container}=render(el(CaseFacts,{...props,visibleFields:[],updateAction:action}));
   expect(action).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Estado',{selector:'select'}),{target:{value:'waiting_client'}});fireEvent.submit(container.querySelector('form')!);
   await waitFor(()=>expect(action).toHaveBeenCalledTimes(1));const data=action.mock.calls[0][0] as FormData;
   expect(data.get('case_id')).toBe(props.caseId);expect(data.get('status')).toBe('waiting_client');
  });
 });
}
describe('Presentación de datos y propiedad',()=>{
 it('evita que el adaptador heredado borre la flecha nativa de los datos V3',()=>{
  const css=readFileSync('src/components/approved/ApprovedDetail.module.css','utf8');
  expect(css).toContain('.summaryLayout :is(.facts,.tools,.agentBody) :is(input,select,textarea)');
  expect(css).not.toContain('.summaryLayout :is(input,select,textarea){background:');
  expect(readFileSync('src/components/approved/CaseSummaryLayout.tsx','utf8')).toContain('styles.factsV3');
 });
 it('mantiene moneda vacía explícita y fecha con vencimiento real',()=>{
  const terms=getIndustryTerms('inmobiliaria'),fields=getCaseFields('inmobiliaria').filter(f=>['moneda_operacion','fecha_relevante'].includes(f.key));
  const {container}=render(el(CaseFacts,{caseId:'fake',caseType:null,status:'new',industry:'inmobiliaria',metadata:{fecha_relevante:'2020-01-01'},visibleFields:fields,fields,statusOptions:getCaseStatuses('inmobiliaria'),labels:{title:terms.datosTitulo,edit:terms.editarDatos,update:terms.actualizarCta},updateAction:vi.fn()}));
  expect(container.querySelector('dl')!.textContent).toContain('Sin definir');expect(container.querySelector('dl')!.textContent).toContain('01/01/2020');expect(container.querySelector('dl')!.textContent).toContain('vencido hace');
 });
 const property={id:'p2',name:'Departamento Centro',address:null,status:'reservada',property_type:'departamento'};
 const properties=[{id:'p2',name:'Departamento Centro',address:null},{id:'p1',name:'Casa',address:'Calle 1'}];
 for(const role of ['admin','employee','auditor','client'] as const)it(`conserva lectura/vínculo y permiso de propiedad · ${role}`,()=>{
  const action=vi.fn();const {container}=render(el(LinkedProperty,{caseId:'fake',property,properties,canUpdate:canUpdateCase(role),linkAction:action}));
  expect(screen.getByRole('link',{name:'Ver ficha'}).getAttribute('href')).toBe('/propiedades/p2');expect(screen.getByText('Sin dirección')).toBeDefined();expect(screen.getByText(getPropertyStatusLabel('reservada'))).toBeDefined();
  expect(container.querySelectorAll('form')).toHaveLength(canUpdateCase(role)?1:0);expect(action).not.toHaveBeenCalled();
  if(canUpdateCase(role)){const form=container.querySelector('form')!,data=new FormData(form);expect(Object.fromEntries(data)).toEqual({case_id:'fake',property_id:'p2'});expect(Array.from((screen.getByLabelText('Vincular propiedad') as HTMLSelectElement).options).map(o=>o.value)).toEqual(['','p2','p1']);}
 });
 it('mantiene desvincular como valor vacío y envía la misma acción',async()=>{
  const action=vi.fn().mockResolvedValue(undefined);const {container}=render(el(LinkedProperty,{caseId:'fake',property,properties,canUpdate:true,linkAction:action}));
  fireEvent.change(screen.getByLabelText('Vincular propiedad'),{target:{value:''}});fireEvent.submit(container.querySelector('form')!);await waitFor(()=>expect(action).toHaveBeenCalledTimes(1));expect(Object.fromEntries(action.mock.calls[0][0] as FormData)).toEqual({case_id:'fake',property_id:''});
 });
 it('presenta propiedad ausente sin inventar vínculos',()=>{
  const {container}=render(el(LinkedProperty,{caseId:'fake',property:null,properties:[],canUpdate:true,linkAction:vi.fn()}));expect(screen.getByText('Sin propiedad asociada.')).toBeDefined();expect(screen.queryByRole('link')).toBeNull();expect(new FormData(container.querySelector('form')!).get('property_id')).toBe('');
 });
 it('mantiene Guardando y bloqueo mientras se guarda la propiedad',()=>{
  pending.value=true;render(el(LinkedProperty,{caseId:'fake',property,properties,canUpdate:true,linkAction:vi.fn()}));const button=screen.getByRole('button',{name:'Guardando...'}) as HTMLButtonElement;expect(button.disabled).toBe(true);expect(button.getAttribute('aria-busy')).toBe('true');
 });
});
describe('WhatsApp V3 de operación sin efectos automáticos',()=>{
 const base={context:'operation' as const,resourceId:'fake',defaultMessage:'Mensaje de prueba',appearance:'record' as const};
 it('prepara una plantilla editable sin abrir, copiar ni registrar al montar/generar',()=>{
  const open=vi.spyOn(window,'open').mockReturnValue(null);render(el(WhatsAppIntentBuilder,base));expect(screen.queryByRole('textbox')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Generar mensaje'}));expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(base.defaultMessage);expect(logWhatsAppAction).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
 });
 it('copia el texto editado y registra el mismo evento/contexto',async()=>{
  const write=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{value:{writeText:write},configurable:true});render(el(WhatsAppIntentBuilder,base));fireEvent.click(screen.getByRole('button',{name:'Generar mensaje'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'Texto revisado'}});fireEvent.click(screen.getByRole('button',{name:'Copiar'}));await waitFor(()=>expect(logWhatsAppAction).toHaveBeenCalledWith('fake','operation','whatsapp_message_generated'));expect(write).toHaveBeenCalledWith('Texto revisado');expect(screen.getByRole('button',{name:'Copiado!'})).toBeDefined();
 });
 for(const phone of [null,'+54 9 11 5555 0100'])it(`mantiene enlace y evento al abrir WhatsApp · ${phone?'con teléfono':'sin teléfono'}`,async()=>{
  const open=vi.spyOn(window,'open').mockReturnValue(null);render(el(WhatsAppIntentBuilder,{...base,phone}));fireEvent.click(screen.getByRole('button',{name:'Generar mensaje'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'Texto & revisión'}});fireEvent.click(screen.getByRole('button',{name:'Abrir WhatsApp'}));await waitFor(()=>expect(logWhatsAppAction).toHaveBeenCalledWith('fake','operation','whatsapp_link_opened'));expect(open).toHaveBeenCalledWith(phone?buildWhatsAppLink(phone,'Texto & revisión'):'https://wa.me/?text='+encodeURIComponent('Texto & revisión'),'_blank');
 });
 it('la variante compacta conserva cierre y borrador, sin heredar la apariencia de operación',()=>{
  render(el(WhatsAppIntentBuilder,{...base,compact:true}));fireEvent.click(screen.getByRole('button',{name:'Preparar mensaje'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'Borrador cliente'}});fireEvent.click(screen.getByRole('button',{name:'Cerrar mensaje'}));fireEvent.click(screen.getByRole('button',{name:'Preparar mensaje'}));expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador cliente');
 });
});
