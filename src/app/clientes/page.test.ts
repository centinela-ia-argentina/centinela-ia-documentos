/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:vi.fn((path:string)=>{throw new Error(`redirect:${path}`);})}));
vi.mock('@/lib/auth/getUserProfile',()=>({getUserProfile:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}));
vi.mock('@/components/layout/AppShell',()=>({AppShell:({children}:{children:React.ReactNode})=>React.createElement('div',{'data-testid':'shell'},children)}));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import ClientesPage from './page';
const auth=vi.mocked(getUserProfile),db=vi.mocked(createClient);
const from=vi.fn(),select=vi.fn(),eq=vi.fn(),is=vi.fn(),order=vi.fn();
let reply:{data:unknown[]|null;error:unknown};
function session(role='admin'){auth.mockResolvedValue({user:{id:'fixture-user'},profile:{role,organization_id:'fixture-org'}} as never);}
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden');}));session();reply={data:[{id:'c1',name:'Primera',client_type:'comprador',status:'activo'},{id:'c2',name:'Segunda',client_type:'inquilino',status:'en_seguimiento'}],error:null};const query={select,eq,is,order};from.mockReturnValue(query);select.mockReturnValue(query);eq.mockReturnValue(query);is.mockReturnValue(query);order.mockImplementation(()=>Promise.resolve(reply));db.mockResolvedValue({from} as never);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function page(searchParams: { q?: string; estado?: string } = {}){return render(await ClientesPage({ searchParams: Promise.resolve(searchParams) }));}
describe('ClientesPage contrato de datos estable y presentación de listado',()=>{
 it('preserves table, select, organization, archive, descending order and row order',async()=>{await page();expect(from).toHaveBeenCalledWith('clients');expect(select).toHaveBeenCalledWith('*');expect(eq).toHaveBeenCalledWith('organization_id','fixture-org');expect(is).toHaveBeenCalledWith('archived_at',null);expect(order).toHaveBeenCalledWith('created_at',{ascending:false});expect(screen.getAllByRole('link',{name:/Ver ficha:/}).map(e=>e.getAttribute('href'))).toEqual(['/clientes/c1','/clientes/c2']);for(const fn of [from,select,eq,is,order])expect(fn).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();});
 it.each(['admin','employee'])('preserves creation permission for %s',async role=>{session(role);await page();expect(screen.getByRole('link',{name:'Nuevo cliente'}).getAttribute('href')).toBe('/clientes/nuevo');});
 it.each(['auditor','unknown'])('keeps %s read-only',async role=>{session(role);await page();expect(screen.queryByRole('link',{name:'Nuevo cliente'})).toBeNull();expect(screen.getAllByRole('link',{name:/Ver ficha:/})).toHaveLength(2);});
 it('redirects unauthenticated before DB',async()=>{auth.mockResolvedValue({user:null,profile:null});await expect(ClientesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/login');expect(db).not.toHaveBeenCalled();});
 it('redirects missing profile before DB',async()=>{auth.mockResolvedValue({user:{id:'fixture-user'},profile:null} as never);await expect(ClientesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/onboarding');expect(db).not.toHaveBeenCalled();});
 it('denies client role before DB',async()=>{session('client');await expect(ClientesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/acceso-denegado');expect(db).not.toHaveBeenCalled();});
 it('uses one h1 without mock controls/fixtures',async()=>{await page();expect(screen.getByRole('heading',{level:1,name:'Clientes e interesados'})).toBeTruthy();expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByText(/Propuesta V1|Lucía Fernández|Sin conexión al sistema/)).toBeNull();});
 it('filtra por búsqueda sin reconsultar la base',async()=>{await page({ q: 'primera' });expect(from).toHaveBeenCalledTimes(1);expect(screen.getAllByRole('link',{name:/Ver ficha:/})).toHaveLength(1);});
 it('filtra por estado de segmento en memoria',async()=>{await page({ estado: 'en_seguimiento' });expect(from).toHaveBeenCalledTimes(1);expect(screen.getAllByRole('link',{name:/Ver ficha:/})).toHaveLength(1);expect(screen.getByRole('link',{current:'page'}).textContent).toBe('En seguimiento');});
 it('búsqueda sin coincidencias muestra recorte y no vacío de cartera',async()=>{await page({ q: 'zzz' });expect(screen.getByRole('heading',{name:'No hay coincidencias con este filtro'})).toBeTruthy();expect(screen.queryByRole('heading',{name:'Aún no tenés clientes registrados'})).toBeNull();});
 it.each([[],null])('shows empty only on successful query %j',async data=>{reply={data,error:null};await page();expect(screen.getByRole('heading',{name:'Aún no tenés clientes registrados'})).toBeTruthy();expect(screen.getByRole('link',{name:'Cargar primer cliente'}).getAttribute('href')).toBe('/clientes/nuevo');expect(screen.queryByText('No se pudo cargar la cartera')).toBeNull();});
 it.each(['auditor','unknown'])('no creation actions in read-only empty state %s',async role=>{session(role);reply.data=[];await page();expect(screen.queryByRole('link',{name:'Cargar primer cliente'})).toBeNull();});
 it.each([null,[],[{id:'partial',name:'Partial record fixture'}]])('prioritizes error over empty or partial data %j',async data=>{reply={data,error:{message:'Private database error fixture'}};await page();expect(screen.getByRole('heading',{name:'No se pudo cargar la cartera'})).toBeTruthy();expect(screen.queryByText('Aún no tenés clientes registrados')).toBeNull();expect(screen.queryByText(/Private database|Partial record/)).toBeNull();expect(screen.queryAllByRole('link',{name:/Ver ficha:/})).toHaveLength(0);const retry=screen.getByRole('button',{name:'Reintentar'});expect(retry.getAttribute('type')).toBe('submit');expect(retry.closest('form')?.getAttribute('action')).toBe('/clientes');expect(retry.closest('form')?.getAttribute('method')).toBe('get');expect(screen.queryByRole('link',{name:'Cargar primer cliente'})).toBeNull();});
 it('retains read-only retry without granting creation',async()=>{session('auditor');reply={data:null,error:{message:'private'}};await page();expect(screen.queryAllByRole('link',{name:'Cargar primer cliente'})).toHaveLength(0);expect(screen.getByRole('button',{name:'Reintentar'})).toBeTruthy();});
});
