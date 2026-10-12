/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'shell' }, children) }));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import PropiedadesPage from './page';
const auth = vi.mocked(getUserProfile), db=vi.mocked(createClient);
const from=vi.fn(), select=vi.fn(), eq=vi.fn(), is=vi.fn(), order=vi.fn();
let reply: {data: unknown[] | null; error: unknown};
function session(role='admin') { auth.mockResolvedValue({user:{id:'fixture'},profile:{role,organization_id:'fixture-org'}} as never); }
beforeEach(() => { vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden');}));session();reply={data:[{id:'p1',name:'Primera',status:'disponible',property_type:'casa'},{id:'p2',name:'Segunda',status:'vendida',property_type:'local'}],error:null};
 const query={select,eq,is,order};from.mockReturnValue(query);select.mockReturnValue(query);eq.mockReturnValue(query);is.mockReturnValue(query);order.mockImplementation(()=>Promise.resolve(reply));db.mockResolvedValue({from} as never);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function page(){return render(await PropiedadesPage());}
describe('PropiedadesPage unchanged server contract and new presentation',()=>{
 it('preserves query/table/org/archive/order and source order',async()=>{await page();expect(from).toHaveBeenCalledWith('properties');expect(select).toHaveBeenCalledWith('*');expect(eq).toHaveBeenCalledWith('organization_id','fixture-org');expect(is).toHaveBeenCalledWith('archived_at',null);expect(order).toHaveBeenCalledWith('created_at',{ascending:false});const links=screen.getAllByRole('link',{name:/Ver ficha:/});expect(links.map(x=>x.getAttribute('href'))).toEqual(['/propiedades/p1','/propiedades/p2']);for (const spy of [from,select,eq,is,order]) expect(spy).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();});
 it.each(['admin','employee'])('allows creation for %s with actual policy',async role=>{session(role);await page();expect(screen.getByRole('link',{name:'Nueva propiedad'}).getAttribute('href')).toBe('/propiedades/nueva');});
 it.each(['auditor','unknown'])('preserves read-only presentation for %s',async role=>{session(role);await page();expect(screen.queryByRole('link',{name:'Nueva propiedad'})).toBeNull();expect(screen.getAllByRole('link',{name:/Ver ficha:/})).toHaveLength(2);});
 it('redirects unauthenticated before database',async()=>{auth.mockResolvedValue({user:null,profile:null});await expect(PropiedadesPage()).rejects.toThrow('redirect:/login');expect(db).not.toHaveBeenCalled();});
 it('redirects missing profile before database',async()=>{auth.mockResolvedValue({user:{id:'fixture'},profile:null} as never);await expect(PropiedadesPage()).rejects.toThrow('redirect:/onboarding');expect(db).not.toHaveBeenCalled();});
 it('denies client before database',async()=>{session('client');await expect(PropiedadesPage()).rejects.toThrow('redirect:/acceso-denegado');expect(db).not.toHaveBeenCalled();});
 it('shows new heading and preserves real actions without demo controls',async()=>{await page();expect(screen.getByRole('heading',{level:1,name:'Cartera de propiedades'})).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByText('Solo lectura')).toBeNull();});
 it('uses real creation route in empty state',async()=>{reply.data=[];await page();expect(screen.getByRole('heading',{name:'Todavía no hay propiedades cargadas'})).toBeTruthy();expect(screen.getByRole('link',{name:'Cargar primera propiedad'}).getAttribute('href')).toBe('/propiedades/nueva');});
 it('read-only empty state has no creation controls',async()=>{session('auditor');reply.data=[];await page();expect(screen.queryByRole('link')).toBeNull();});
 it('keeps previously recorded null/error fallback unchanged, not a new error fix',async()=>{reply={data:null,error:{message:'Private error detail'}};await page();expect(screen.getByText('Todavía no hay propiedades cargadas')).toBeTruthy();expect(screen.queryByText('Private error detail')).toBeNull();});
});
