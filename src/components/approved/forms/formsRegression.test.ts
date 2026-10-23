/** @vitest-environment jsdom */
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
vi.mock('next/link',()=>({default:({children,...p}:any)=>React.createElement('a',p,children)}));
vi.mock('@/components/ui/FormSubmitButton',()=>({FormSubmitButton:({label}:any)=>React.createElement('button',{type:'submit'},label)}));
import {CivilDateField,dateTextToISO} from './CivilDateField';
import {RentalContractForm} from './RentalContractForm';
import {ClientRecordForm} from './ClientRecordForm';
import {RentalPortfolio,type PortfolioRental} from '@/app/alquileres/RentalPortfolio';
import {RentalDetailMode} from '@/app/alquileres/RentalDetailMode';
afterEach(cleanup);
const action=vi.fn();
describe('approved civil date transport',()=>{
 it.each([['29/02/2024','2024-02-29'],['31/01/2026','2026-01-31'],['01/01/2026','2026-01-01'],['29/02/2025',''],['31/04/2026',''],['00/01/2026',''],['1/1/2026',''],['2026-01-01',''],['01/13/2026',''],['','']])('%s → %s',(a,b)=>expect(dateTextToISO(a)).toBe(b));
 it('posts only ISO via named hidden input and rejects impossible typed dates',()=>{
  const {container}=render(React.createElement('form',null,React.createElement('label',{htmlFor:'date'},'Inicio'),React.createElement(CivilDateField,{id:'date',name:'start_date',label:'Inicio',required:true})));
  const field=screen.getByLabelText('Inicio') as HTMLInputElement;
  fireEvent.change(field,{target:{value:'31/01/2026'}});
  expect(new FormData(container.querySelector('form')!).getAll('start_date')).toEqual(['2026-01-31']);expect(field.checkValidity()).toBe(true);
  fireEvent.change(field,{target:{value:'31/02/2026'}});expect(field.checkValidity()).toBe(false);expect(container.querySelector<HTMLInputElement>('[name=start_date]')!.value).toBe('');
  fireEvent.change(container.querySelector('input[type=date]')!,{target:{value:'2024-02-29'}});expect(field.value).toBe('29/02/2024');expect(field.checkValidity()).toBe(true);
 });
 it('keeps an empty optional last adjustment valid',()=>{const {container}=render(React.createElement(CivilDateField,{id:'date',name:'last_adjustment_date',label:'Último ajuste'}));expect(container.querySelector('input')!.checkValidity()).toBe(true)});
});
describe('existing rental form contract',()=>{
 it('retains all 11 fields, defaults, required fields and explicit action',()=>{const {container}=render(React.createElement(RentalContractForm,{action,properties:[{id:'p',name:'Centro'}]}));
 const names=[...container.querySelectorAll('[name]')].map(x=>x.getAttribute('name'));expect(names).toEqual(['property_id','tenant_name','base_amount','currency','index_type','fixed_pct','adjustment_period_months','start_date','last_adjustment_date','status','notes']);
 expect(container.querySelector<HTMLSelectElement>('[name=currency]')!.value).toBe('ARS');expect(container.querySelector<HTMLSelectElement>('[name=adjustment_period_months]')!.value).toBe('3');expect([...container.querySelectorAll('[required]')].map(x=>x.id)).toEqual(['new-rental-base_amount','new-rental-start_date']);
 expect(screen.getByLabelText('Índice de ajuste').querySelectorAll('option')).toHaveLength(4);expect(action).not.toHaveBeenCalled();
 });
 it('preserves edit id, dates and twelve-month fallback',()=>{const {container}=render(React.createElement(RentalContractForm,{action,properties:[],record:{id:'r',start_date:'2026-01-31T00:00:00Z',adjustment_period_months:null} as any}));expect(container.querySelector<HTMLInputElement>('[name=rental_id]')!.value).toBe('r');expect(container.querySelector<HTMLSelectElement>('[name=adjustment_period_months]')!.value).toBe('12');expect(container.querySelector<HTMLInputElement>('[name=start_date]')!.value).toBe('2026-01-31')});
});
describe('existing client form contract',()=>{
 it('keeps sixteen named fields, USD and only name required with associated labels',()=>{const {container}=render(React.createElement(ClientRecordForm,{action}));expect(container.querySelectorAll('[name]')).toHaveLength(16);expect(container.querySelector<HTMLSelectElement>('[name=currency]')!.value).toBe('USD');expect([...container.querySelectorAll('[required]')].map(x=>x.getAttribute('name'))).toEqual(['name']);for(const field of container.querySelectorAll('input,select,textarea'))expect(container.querySelector(`label[for="${field.id}"]`)).toBeTruthy();expect(container.querySelector('[name=zone]')).toBeNull();expect(container.querySelector('[name=budget_min]')!.getAttribute('min')).toBeNull();expect(action).not.toHaveBeenCalled()});
 it('keeps criteria visible for every client type and preserves edit id',()=>{const {container}=render(React.createElement(ClientRecordForm,{action,record:{id:'c',name:'Lucía',client_type:'propietario'} as any}));expect(container.querySelector<HTMLInputElement>('[name=client_id]')!.value).toBe('c');expect(container.querySelectorAll('[name]')).toHaveLength(17);expect(screen.getByLabelText('Interés')).toBeTruthy();expect(screen.getByLabelText('Nombre del interesado *').getAttribute('value')).toBe('Lucía')});
});
const rentals=[{id:'a',tenant_name:'Lucía',propertyName:'Plaza Moreno',status:'vigente',currency:'ARS',current_amount:1000,estado:{tipo:'proximo',label:'Ajusta hoy'}},{id:'b',tenant_name:'Pedro',propertyName:'Calle 12',status:'finalizado',estado:{tipo:'sin_dato',label:''}},{id:'c',tenant_name:'Histórico',status:null,estado:{tipo:'sin_dato',label:''}}] as PortfolioRental[];
describe('rental portfolio and read-first detail',()=>{
 it('filters tenant and property, separates finalizados and retains unknown legacy records under Otros',()=>{render(React.createElement(RentalPortfolio,{rentals,canManage:false}));expect(screen.getByText('Lucía')).toBeTruthy();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'MORENO'}});expect(screen.getByText('Lucía')).toBeTruthy();fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Finalizados'}));expect(screen.getByText('Pedro')).toBeTruthy();expect(screen.getByText('Finalizado')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Otros'}));expect(screen.getByText('Histórico')).toBeTruthy();expect(screen.getByRole('link',{name:'Ver contrato'}).getAttribute('href')).toBe('/alquileres/c')});
 it('empty auditor portfolio exposes no creation action',()=>{render(React.createElement(RentalPortfolio,{rentals:[],canManage:false}));expect(screen.getByText('No hay alquileres registrados')).toBeTruthy();expect(screen.queryByRole('link')).toBeNull()});
 it('does not mount an editor for auditor',()=>{render(React.createElement(RentalDetailMode,{canManage:false,readView:'Lectura',editForm:React.createElement('input',{name:'secret'})}));expect(screen.getByText('Lectura')).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();expect(document.querySelector('[name=secret]')).toBeNull()});
 it('starts in read view and keeps an unsaved draft after cancel',()=>{render(React.createElement(RentalDetailMode,{canManage:true,readView:'Lectura',editForm:React.createElement('input',{'aria-label':'Inquilino',defaultValue:'Original'})}));expect(screen.queryByRole('textbox')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Editar contrato'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'Borrador'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));fireEvent.click(screen.getByRole('button',{name:'Editar contrato'}));expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Borrador')});
});
