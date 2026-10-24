/** @vitest-environment jsdom */
import React from 'react';
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {AgendaClient,type AgendaEvento} from './AgendaClient';
import {AgendaCommandCenter} from './AgendaCommandCenter';
import {getAgendaLabels,getIndustryTerms} from '@/lib/industries/uiLabels';
import {guardarEventoManual,guardarTurno,editarEventoAgenda,eliminarEventoAgenda} from './actions';
import type {IndustryType} from '@/lib/industries/documentTypes';
vi.mock('./actions',()=>({guardarEventoManual:vi.fn(),guardarTurno:vi.fn(),editarEventoAgenda:vi.fn(),eliminarEventoAgenda:vi.fn()}));
const refresh=vi.hoisted(()=>vi.fn());vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
// Native dialog keyboard/focus tested separately in Chromium, not simulated by jsdom.
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};});
beforeEach(()=>{vi.clearAllMocks();for(const f of [guardarEventoManual,guardarTurno,editarEventoAgenda,eliminarEventoAgenda])vi.mocked(f).mockResolvedValue({ok:true} as any);vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
const h=React.createElement;
const date=new Date();const today=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const event:AgendaEvento={id:'manual-1',rawId:'raw-1',fecha:today,hora:'10:30',titulo:'Revisar documentación',detalle:'Revisar antecedentes',tipo:'evento',href:'/agenda'};
const firma:AgendaEvento={...event,id:'firma-2',titulo:'Firma de escritura',tipo:'firma'};
function client(can=true){return render(h(AgendaClient,{industry:'inmobiliaria',eventos:[event,firma],cases:[{id:'c1',title:'Departamento Centro'}],puedeGuardar:can}));}
async function detail(){fireEvent.click(screen.getAllByRole('button',{name:/Revisar documentación/})[0]);return screen.getByRole('dialog');}
describe('Agenda V1: contracts and CRUD preserved',()=>{
 it.each(['inmobiliaria','legal','escribania'] as IndustryType[])('retains filter options/priority list and industry labels for %s',industry=>{
  const select=vi.fn();render(h(AgendaCommandCenter,{industry,eventos:[event,firma],agendaLabels:getAgendaLabels(industry),terms:getIndustryTerms(industry),puedeGuardar:true,onCreate:vi.fn(),onSelect:select}));
  expect(screen.getByRole('combobox',{name:'Mostrar eventos'}).querySelectorAll('option').length).toBe(6);
  fireEvent.change(screen.getByRole('combobox',{name:'Mostrar eventos'}),{target:{value:'firma'}});
  const aside=screen.getByRole('complementary');expect(within(aside).getByRole('button',{name:/Revisar documentación/})).toBeTruthy();
  fireEvent.click(within(aside).getByRole('button',{name:/Firma de escritura/}));expect(select).toHaveBeenCalledWith(firma);
 });
 it('auditor cannot create/edit/delete in visible UI',async()=>{client(false);expect(screen.queryByRole('button',{name:'Nuevo evento'})).toBeNull();const d=await detail();expect(within(d).queryByRole('button',{name:'Editar'})).toBeNull();expect(within(d).queryByRole('button',{name:'Eliminar'})).toBeNull();});
 it('preserves form drafts when collapsed',()=>{client();fireEvent.click(screen.getByRole('button',{name:'Nuevo evento'}));fireEvent.change(screen.getByTestId('agenda-titulo'),{target:{value:'Borrador'}});fireEvent.click(screen.getByRole('button',{name:'Cerrar formulario'}));fireEvent.click(screen.getByRole('button',{name:'Nuevo evento'}));expect((screen.getByTestId('agenda-titulo') as HTMLInputElement).value).toBe('Borrador');});
 it('retains manual creation handler and payload',async()=>{client();fireEvent.click(screen.getByRole('button',{name:'Nuevo evento'}));fireEvent.change(screen.getByTestId('agenda-titulo'),{target:{value:'  Revisión  '}});fireEvent.change(screen.getByTestId('agenda-fecha'),{target:{value:'2026-11-12'}});fireEvent.change(screen.getByTestId('agenda-hora'),{target:{value:'14:30'}});fireEvent.change(screen.getByTestId('agenda-case-select'),{target:{value:'c1'}});fireEvent.click(screen.getByTestId('agenda-submit'));await waitFor(()=>expect(guardarEventoManual).toHaveBeenCalled());expect(vi.mocked(guardarEventoManual).mock.calls[0][0]).toEqual({titulo:'  Revisión  ',fecha:'2026-11-12',hora:'14:30',detalle:'',caseId:'c1'});expect(guardarTurno).not.toHaveBeenCalled();});
 it('retains edit payload and associated case route',async()=>{client();const d=await detail();fireEvent.click(within(d).getByRole('button',{name:'Editar'}));fireEvent.change(within(d).getByLabelText('Título'),{target:{value:'Editado'}});fireEvent.click(within(d).getByRole('button',{name:/Guardar/}));await waitFor(()=>expect(editarEventoAgenda).toHaveBeenCalled());expect(vi.mocked(editarEventoAgenda).mock.calls[0][0]).toMatchObject({id:'raw-1',titulo:'Editado',fecha:today,hora:'10:30',categoria:'manual',detalle:'Revisar antecedentes',caseId:null});await waitFor(()=>expect(refresh).toHaveBeenCalled());});
 it('keeps human confirmation before delete and releases detail on success',async()=>{client();const d=await detail();fireEvent.click(within(d).getByRole('button',{name:'Eliminar'}));expect(window.confirm).toHaveBeenCalled();await waitFor(()=>expect(eliminarEventoAgenda).toHaveBeenCalledWith('raw-1'));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());});
 it('does not delete when confirmation is refused',async()=>{vi.mocked(window.confirm).mockReturnValue(false);client();const d=await detail();fireEvent.click(within(d).getByRole('button',{name:'Eliminar'}));expect(eliminarEventoAgenda).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toBeTruthy();});
 it('keeps edit action failures visible without closing detail',async()=>{vi.mocked(editarEventoAgenda).mockResolvedValue({ok:false,mensaje:'No autorizado'} as any);client();const d=await detail();fireEvent.click(within(d).getByRole('button',{name:'Editar'}));fireEvent.click(within(d).getByRole('button',{name:/Guardar/}));expect(await within(d).findByText('No autorizado')).toBeTruthy();expect(refresh).not.toHaveBeenCalled();});
});
