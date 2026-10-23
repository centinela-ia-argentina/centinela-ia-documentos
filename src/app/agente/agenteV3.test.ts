/** @vitest-environment jsdom */
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AgenteGlobalChat} from './AgenteGlobalChat';
import {preguntarAgenteGlobal} from './actions';
import {getIndustryTerms} from '@/lib/industries/uiLabels';
import {getAgentDisclaimer} from '@/lib/industries/disclaimers';
import type {IndustryType} from '@/lib/industries/documentTypes';
vi.mock('./actions',()=>({preguntarAgenteGlobal:vi.fn()}));
// Avatar internals unchanged; this unit isolates the chat's interaction with it.
vi.mock('@/components/agent/AnulusAgentAvatar',()=>({AnulusAgentAvatar:({onActivate,state,compact}:any)=>React.createElement('button',{onClick:onActivate,'data-state':state,'data-compact':compact,'aria-label':'Activar agente'},'Avatar')}));
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();vi.mocked(preguntarAgenteGlobal).mockResolvedValue({ok:true,respuesta:'**Revisión**\n- Revisá documentos',acciones:[]} as any);});
const h=React.createElement;
const input=()=>screen.getByRole('textbox',{name:'Escribir una consulta para el Agente Anulus'});
describe('Agente V1.2: real handler contracts',()=>{
 it.each(['inmobiliaria','legal','escribania'] as IndustryType[])('keeps industry suggestions and responsible-use copy for %s',industry=>{render(h(AgenteGlobalChat,{industry,puedeUsarIA:true}));expect(screen.getByRole('heading',{level:1})).toBeTruthy();for(const q of getIndustryTerms(industry).agentePreguntasGlobales)expect(screen.getByRole('button',{name:q})).toBeTruthy();expect(screen.getByText(getAgentDisclaimer(industry),{exact:false})).toBeTruthy();});
 it('renders nothing when AI permission is absent',()=>{const v=render(h(AgenteGlobalChat,{industry:'legal',puedeUsarIA:false}));expect(v.container.childElementCount).toBe(0);});
 it('keeps disabled blank input and submits trimmed content with previous history',async()=>{
  render(h(AgenteGlobalChat,{industry:'legal',puedeUsarIA:true}));expect((screen.getByRole('button',{name:'Enviar consulta'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input(),{target:{value:'  Consulta uno  '}});fireEvent.submit(input().closest('form')!);
  await waitFor(()=>expect(preguntarAgenteGlobal).toHaveBeenCalledWith({pregunta:'Consulta uno',historial:[]}));
  await screen.findByText('Revisión');expect((input() as HTMLTextAreaElement).value).toBe('');
  fireEvent.change(input(),{target:{value:'Consulta dos'}});fireEvent.keyDown(input(),{key:'Enter'});
  await waitFor(()=>expect(preguntarAgenteGlobal).toHaveBeenLastCalledWith({pregunta:'Consulta dos',historial:[{rol:'user',texto:'Consulta uno'},{rol:'model',texto:'**Revisión**\n- Revisá documentos'}]}));
 });
 it('Shift+Enter does not submit; activating avatar focuses input',()=>{render(h(AgenteGlobalChat,{industry:'inmobiliaria',puedeUsarIA:true}));fireEvent.change(input(),{target:{value:'Consulta'}});fireEvent.keyDown(input(),{key:'Enter',shiftKey:true});expect(preguntarAgenteGlobal).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Activar agente'}));expect(document.activeElement).toBe(input());});
 it('renders action failure and permits retry without invented response',async()=>{vi.mocked(preguntarAgenteGlobal).mockResolvedValue({ok:false,motivo:'Revisá permisos'} as any);render(h(AgenteGlobalChat,{industry:'legal',puedeUsarIA:true}));fireEvent.change(input(),{target:{value:'Consulta'}});fireEvent.submit(input().closest('form')!);expect((await screen.findByRole('alert')).textContent).toBe('Revisá permisos');expect(screen.queryByText('Revisión')).toBeNull();expect((screen.getByRole('button',{name:'Enviar consulta'}) as HTMLButtonElement).disabled).toBe(true);});
 it('retains connection error copy and releases busy state',async()=>{vi.mocked(preguntarAgenteGlobal).mockRejectedValue(new Error('offline'));render(h(AgenteGlobalChat,{industry:'legal',puedeUsarIA:true}));fireEvent.change(input(),{target:{value:'Consulta'}});fireEvent.submit(input().closest('form')!);expect((await screen.findByRole('alert')).textContent).toContain('error de conexión');});
 it('prevents duplicate sends while pending and keeps avatar thinking',async()=>{let resolve:any;vi.mocked(preguntarAgenteGlobal).mockImplementation(()=>new Promise(r=>{resolve=r}));render(h(AgenteGlobalChat,{industry:'legal',puedeUsarIA:true}));fireEvent.change(input(),{target:{value:'Consulta'}});fireEvent.submit(input().closest('form')!);expect(screen.getByRole('status').textContent).toContain('Analizando');expect(screen.getByRole('button',{name:'Activar agente'}).dataset.state).toBe('thinking');fireEvent.submit(input().closest('form')!);expect(preguntarAgenteGlobal).toHaveBeenCalledTimes(1);resolve({ok:true,respuesta:'Listo',acciones:[]});await screen.findByText('Listo');});
});
