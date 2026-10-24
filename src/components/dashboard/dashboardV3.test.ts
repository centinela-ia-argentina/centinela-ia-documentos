/** @vitest-environment jsdom */
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {DashboardView,operationValue,formatRelevantDate} from './DashboardView';
import {PrimerosPasos} from './PrimerosPasos';
import {getIndustryTerms} from '@/lib/industries/uiLabels';
import type {IndustryType} from '@/lib/industries/documentTypes';
vi.mock('next/link',()=>({default:({children,...props}: any)=>React.createElement('a',props,children)}));
afterEach(cleanup);
const h=React.createElement;
const record=(i=1)=>({id:String(i),title:`Registro ${i}`,client_name:'Cliente',case_type:'General',status:'active',metadata:{},created_at:null});
function props(industry:IndustryType='inmobiliaria') {return {industry,terms:getIndustryTerms(industry),greetingName:'Lucía',role:'admin',userName:'Lucía',metrics:[{label:'Activos',value:'06',helper:'Registros activos'},{label:'Documentos',value:'12',helper:'Documentos disponibles'},{label:'Cobertura de análisis',value:'67%',helper:'8 de 12'},{label:'Equipo',value:'03',helper:'Integrantes'}],workspaces:[{title:'Agenda',detail:'Fechas',href:'/agenda'},{title:'Documentos',detail:'Archivos',href:'/documentos'},{title:'Observaciones',detail:'Pendientes',href:'/observaciones'}],activeCases:Array.from({length:6},(_,i)=>record(i)),operationBasePath:industry==='inmobiliaria'?'/operaciones':'/expedientes',hasCase:true,hasDocument:true,hasTeam:false,showGettingStarted:false};}
describe('Inicio V1: presentation preserves data contracts',()=>{
 it.each(['inmobiliaria','legal','escribania'] as IndustryType[])('retains routes, labels, metrics and five-record maximum for %s',industry=>{
  const p=props(industry);render(h(DashboardView,p));
  expect(screen.getByRole('heading',{level:1}).textContent).toContain('Lucía');
  expect(screen.getByRole('link',{name:/Registro 0/}).getAttribute('href')).toBe(p.operationBasePath+'/0');
  expect(screen.queryByRole('link',{name:/Registro 5/})).toBeNull();
  expect(screen.getByRole('link',{name:'Ver '+p.terms.expedientePlural.toLowerCase()}).getAttribute('href')).toBe(p.operationBasePath);
  for(const route of p.workspaces) expect(screen.getByRole('link',{name:new RegExp(route.title)}).getAttribute('href')).toBe(route.href);
  expect(screen.getByText('67%')).toBeTruthy();
 });
 it('retains empty-state destination without silently changing /nuevo',()=>{const p=props();render(h(DashboardView,{...p,activeCases:[],hasCase:false,showGettingStarted:false}));expect(screen.getByRole('link',{name:p.terms.nuevoCta}).getAttribute('href')).toBe('/operaciones/nuevo');});
 it.each([true,false])('retains onboarding admin=%s and exact creation path',admin=>{
  render(h(PrimerosPasos,{hasCase:false,hasDocument:false,hasTeam:false,isAdmin:admin,industry:'inmobiliaria'}));
  expect(screen.getByRole('link',{name:/Nueva operación/}).getAttribute('href')).toBe('/operaciones/nueva');
  expect(!!screen.queryByRole('link',{name:/Invitar equipo/})).toBe(admin);
  expect(screen.getByText(admin?'0/3':'0/2')).toBeTruthy();
 });
 it('keeps completed steps informational with no duplicate action',()=>{render(h(PrimerosPasos,{hasCase:true,hasDocument:false,hasTeam:false,isAdmin:false,industry:'legal'}));expect(screen.queryByRole('link',{name:/Nuevo expediente/})).toBeNull();expect(screen.getByText('1/2')).toBeTruthy();});
 it('preserves reference amount/currency/date formatting',()=>{expect(operationValue({...record(),metadata:{valor_operacion:125000,moneda_operacion:'ARS'}})).toBe('AR$ 125.000');expect(operationValue(record())).toBeNull();expect(formatRelevantDate('invalid')).toBe('Fecha por revisar');expect(formatRelevantDate()).toBe('Sin fecha definida');});
});
