/** @vitest-environment jsdom */
import React from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,render,screen,fireEvent } from '@testing-library/react';
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:vi.fn((path:string)=>{throw new Error(`redirect:${path}`);}),notFound:vi.fn(()=>{throw new Error('notFound');})}));
vi.mock('@/lib/auth/getUserProfile',()=>({getUserProfile:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}));
vi.mock('@/components/layout/AppShell',()=>({AppShell:({children}:{children:React.ReactNode})=>React.createElement('div',null,children)}));
vi.mock('../actions',()=>({updateProperty:vi.fn(),extraerDatosPropiedadIA:vi.fn()}));
vi.mock('./GenerarAvisoButton',()=>({GenerarAvisoButton:()=>React.createElement('p',null,'AI ad tool')}));
vi.mock('./PropertyMatchAiButton',()=>({PropertyMatchAiButton:()=>React.createElement('p',null,'AI match tool')}));
vi.mock('./DescargarFichaPdfButton',()=>({DescargarFichaPdfButton:()=>React.createElement('p',null,'PDF tool')}));
vi.mock('@/components/WhatsAppIntentBuilder',()=>({WhatsAppIntentBuilder:()=>React.createElement('p',null,'WhatsApp tool')}));
vi.mock('./TasacionPanel',()=>({TasacionPanel:({canManage,useAi}:{canManage:boolean;useAi:boolean})=>React.createElement('p',null,`Valuation manage=${canManage} ai=${useAi}`)}));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import Page from './page';
const calls:unknown[][]=[];
const record={id:'fixture-property',organization_id:'fixture-org',updated_at:'revision',name:'Fixture property',status:'disponible',property_type:'departamento',address:'Fixture address',surface_total_m2:0,surface_covered_m2:0,rooms:0,price:0,currency:'ARS',created_at:'2026-01-01',owners:'Fixture owner'};
let propertyReply:{data:unknown;error:unknown};
let role='admin';
function auth(){vi.mocked(getUserProfile).mockResolvedValue({user:{id:'fixture-user'},profile:{role,organization_id:'fixture-org'}} as never);}
beforeEach(()=>{
 vi.clearAllMocks();calls.length=0;role='admin';auth();propertyReply={data:record,error:null};
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Real network forbidden');}));
 vi.mocked(createClient).mockResolvedValue({from:(table:string)=>{
  calls.push(['from',table]);const replies:Record<string,unknown>={properties:propertyReply,documents:{data:[{id:'fixture-doc',file_name:'Fixture.pdf'}]},organizations:{data:{industry_type:'inmobiliaria'}},cases:{data:[{id:'fixture-operation',title:'Fixture operation',status:'new'}]},property_comparables:{data:[]},clients:{data:[{id:'fixture-client',name:'Fixture client',desired_property_type:'departamento',min_rooms:0,status:'activo'}]}};
  const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(replies[table]).then(resolve)};
  for(const method of ['select','eq','is','in','limit','order','single','maybeSingle'])q[method]=(...args:unknown[])=>{calls.push([table,method,...args]);return q;};return q;
 }} as never);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function page(){return render(await Page({params:Promise.resolve({id:'fixture-property'})}));}
describe('property detail: unchanged server data/permission contract',()=>{
 it('keeps organization scopes, tables, filters, limits and orders',async()=>{await page();expect(calls).toContainEqual(['properties','eq','id','fixture-property']);for(const table of ['properties','documents','cases','property_comparables','clients'])expect(calls).toContainEqual([table,'eq','organization_id','fixture-org']);expect(calls).toContainEqual(['documents','limit',50]);expect(calls).toContainEqual(['documents','is','archived_at',null]);expect(calls).toContainEqual(['clients','in','status',['activo','en_seguimiento']]);for(const table of ['cases','property_comparables']){expect(calls).toContainEqual([table,'eq','property_id','fixture-property']);expect(calls).toContainEqual([table,'order','created_at',{ascending:false}]);}expect(fetch).not.toHaveBeenCalled();});
 it('renders zero distinctly from missing data and no duplicate technical form initially',async()=>{await page();expect(screen.getByText('$ 0')).toBeTruthy();expect(screen.getAllByText('0 m²')).toHaveLength(2);expect(screen.queryByRole('textbox',{name:'Nombre de la propiedad *'})).toBeNull();expect(screen.queryByText('Valor de mercado')).toBeNull();});
 it('preserves real operation/client routes and matching counts',async()=>{await page();fireEvent.click(screen.getByRole('tab',{name:'Vínculos'}));expect(screen.getByRole('link',{name:'Abrir operación'}).getAttribute('href')).toBe('/expedientes/fixture-operation');expect(screen.getByRole('link',{name:'Ver cliente'}).getAttribute('href')).toBe('/clientes/fixture-client');expect(screen.getByText('2/2')).toBeTruthy();expect(screen.getByText('AI match tool')).toBeTruthy();});
 it('does not query matching clients for unavailable property',async()=>{propertyReply.data={...record,status:'vendida'};await page();expect(calls).not.toContainEqual(['from','clients']);fireEvent.click(screen.getByRole('tab',{name:'Vínculos'}));expect(screen.queryByRole('link',{name:'Ver cliente'})).toBeNull();});
 it.each(['admin','employee'])('retains edit and AI capability for %s',async next=>{role=next;auth();await page();expect(screen.getByRole('button',{name:'Editar propiedad'})).toBeTruthy();fireEvent.click(screen.getByRole('tab',{name:'Tasación y comparables'}));expect(screen.getByText('Valuation manage=true ai=true')).toBeTruthy();});
 it.each(['auditor','unknown'])('retains read-only presentation for %s',async next=>{role=next;auth();await page();expect(screen.queryByRole('button',{name:'Editar propiedad'})).toBeNull();fireEvent.click(screen.getByRole('tab',{name:'Tasación y comparables'}));expect(screen.getByText('Valuation manage=false ai=false')).toBeTruthy();fireEvent.click(screen.getByRole('tab',{name:'Comercial'}));expect(screen.queryByText('AI ad tool')).toBeNull();expect(screen.getByRole('button',{name:'Estado de publicación'}).closest('fieldset')?.disabled).toBe(true);expect(screen.queryByRole('button',{name:'Guardar enlaces'})).toBeNull();});
 it('redirects missing user before database',async()=>{vi.mocked(getUserProfile).mockResolvedValue({user:null,profile:null});await expect(page()).rejects.toThrow('redirect:/login');expect(createClient).not.toHaveBeenCalled();});
 it('redirects missing profile before database',async()=>{vi.mocked(getUserProfile).mockResolvedValue({user:{id:'fixture'},profile:null} as never);await expect(page()).rejects.toThrow('redirect:/onboarding');expect(createClient).not.toHaveBeenCalled();});
 it('denies client before querying',async()=>{role='client';auth();await expect(page()).rejects.toThrow('redirect:/acceso-denegado');expect(createClient).not.toHaveBeenCalled();});
 it.each([{data:null,error:null},{data:null,error:{message:'Private detail'}}])('keeps notFound on absence/error',async reply=>{propertyReply=reply;await expect(page()).rejects.toThrow('notFound');expect(calls).toHaveLength(5);});
});
