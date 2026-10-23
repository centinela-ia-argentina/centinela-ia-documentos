/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { CopilotoExpediente } from '@/app/expedientes/[id]/CopilotoExpediente';
import { RadarPlazos } from '@/app/expedientes/[id]/RadarPlazos';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { ItemCronologia } from '@/app/expedientes/[id]/CronologiaExpediente';
const pending = vi.hoisted(() => ({ value: false }));
vi.mock('react-dom', async (original) => ({ ...await original<typeof import('react-dom')>(), useFormStatus: () => ({ pending: pending.value }) }));
vi.mock('@/app/expedientes/actions', () => ({ generarResumenExpediente: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/app/agenda/actions', () => ({ guardarPlazoDetectado: vi.fn().mockResolvedValue({ ok: true }) }));
import { generarResumenExpediente } from '@/app/expedientes/actions';
import { guardarPlazoDetectado } from '@/app/agenda/actions';
const el = React.createElement;
const saved = { resumen_general: 'Lectura de prueba guardada.', estado_actual: 'En reserva', partes: ['Parte de prueba'], puntos_clave: ['Verificar antecedentes'], riesgos_alertas: ['Información ficticia'], proximas_acciones: ['Completar documentación'] };
function item(days = 3, title = 'Plazo de revisión de documentación'): ItemCronologia {
  const date = new Date(); date.setDate(date.getDate() + days);
  return { fecha: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, titulo: title, origen: 'agenda', etiquetaOrigen: 'Agenda', esFuturo: days >= 0 };
}
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); pending.value = false; vi.mocked(guardarPlazoDetectado).mockResolvedValue({ ok: true }); });
for (const industry of ['inmobiliaria', 'legal', 'escribania'] as const) {
  const terms = getIndustryTerms(industry);
  describe(`Prioridad V3 · ${industry}`, () => {
    it('lee el resumen sin generar ni agendar automáticamente', () => {
      const { container } = render(el(CopilotoExpediente, { caseId: 'fake', resumen: saved, generadoEl: '2026-10-22T12:00:00Z', documentosAnalizados: 4, puedeUsarIA: true, terms }));
      expect(screen.getByText('Lectura guardada · Revisar antes de usar.')).toBeDefined();
      expect(screen.getByText(saved.resumen_general)).toBeDefined();
      expect(screen.getByText(/Generado el/)).toBeDefined();
      const details = container.querySelector('details')!;
      expect(details.open).toBe(false);
      fireEvent.click(details.querySelector('summary')!);
      // Native details toggling is verified in Chromium, not emulated by jsdom.
      expect(container.querySelectorAll('summary svg')).toHaveLength(1);
      expect(screen.getByText(terms.partes)).toBeDefined();
      expect(screen.getByText('Riesgos y alertas')).toBeDefined();
      expect(generarResumenExpediente).not.toHaveBeenCalled();
      expect(guardarPlazoDetectado).not.toHaveBeenCalled();
    });
    it('conserva el resumen visible sin permiso de IA y oculta generar', () => {
      render(el(CopilotoExpediente, { caseId:'fake', resumen:saved, generadoEl:null, documentosAnalizados:0, puedeUsarIA:false, terms }));
      expect(screen.getByText(saved.resumen_general)).toBeDefined();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByText(terms.resumenVacio)).toBeNull();
    });
    it('mantiene el estado vacío del rubro y la misma acción ligada al registro', async () => {
      const { container } = render(el(CopilotoExpediente, { caseId:'fake-'+industry, resumen:null, generadoEl:null, documentosAnalizados:0, puedeUsarIA:true, terms }));
      expect(screen.getByText(terms.resumenVacio)).toBeDefined();
      expect(screen.queryByText(/Lectura guardada/)).toBeNull();
      fireEvent.submit(container.querySelector('form')!);
      await waitFor(() => expect(generarResumenExpediente).toHaveBeenCalledTimes(1));
      expect(vi.mocked(generarResumenExpediente).mock.calls[0][0]).toBe('fake-'+industry);
    });
    it('conserva el singular y no genera con documentos analizados al montar', () => {
      render(el(CopilotoExpediente,{caseId:'fake',resumen:null,generadoEl:null,documentosAnalizados:1,puedeUsarIA:true,terms}));
      expect(screen.getByText(/Hay 1 documento analizado/)).toBeDefined();
      expect(generarResumenExpediente).not.toHaveBeenCalled();
    });
    it('mantiene el payload de agenda y el estado existente', async () => {
      vi.mocked(guardarPlazoDetectado).mockResolvedValueOnce({ ok:true, existing:true });
      const date = item();
      render(el(RadarPlazos,{items:[date],caseId:'fake-'+industry,industry}));
      expect(guardarPlazoDetectado).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button',{name:'Cargar a agenda'}));
      await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Ya en agenda'));
      expect(guardarPlazoDetectado).toHaveBeenCalledWith({titulo:date.titulo,fecha:date.fecha,detalle:(industry==='inmobiliaria'?'Vencimiento de la operación':industry==='escribania'?'Vigencia del legajo':'Plazo del expediente')+' · Agenda',caseId:'fake-'+industry});
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
}
describe('Estados y preservación de Resumen V2', () => {
  it('deshabilita generar mientras la acción está pendiente', () => {
    pending.value=true;
    render(el(CopilotoExpediente,{caseId:'fake',resumen:saved,generadoEl:null,documentosAnalizados:1,puedeUsarIA:true,terms:getIndustryTerms('inmobiliaria')}));
    expect((screen.getByRole('button',{name:'Generando…'}) as HTMLButtonElement).disabled).toBe(true);
  });
  it('omite bloques y fecha de generación ausentes, sin inventarlos', () => {
    render(el(CopilotoExpediente,{caseId:'fake',resumen:{...saved,estado_actual:'',partes:[],puntos_clave:[],riesgos_alertas:[],proximas_acciones:[]},generadoEl:null,documentosAnalizados:0,puedeUsarIA:false,terms:getIndustryTerms('legal')}));
    expect(screen.queryByText('Estado:')).toBeNull();
    expect(screen.queryByText(/Generado el/)).toBeNull();
    expect(screen.queryByRole('heading',{level:3})).toBeNull();
  });
  it('presenta la misma deduplicación, orden, conteos y ventana temporal', () => {
    const expired=item(-1,'Vencimiento de documentación');
    const duplicated={...expired,etiquetaOrigen:'IA'};
    const { container }=render(el(RadarPlazos,{caseId:'fake',items:[item(25),item(10),item(3),expired,duplicated,item(31),item(-91)]}));
    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByText('Agenda + IA')).toBeDefined();
    expect(screen.getByText('1 Vencido')).toBeDefined();
    expect(screen.getByText('1 ≤ 7 días')).toBeDefined();
    expect(screen.getByText('1 ≤ 15 días')).toBeDefined();
    expect(screen.getByText('1 ≤ 30 días')).toBeDefined();
    expect(container.querySelector('li')!.textContent).toContain('hace 1 día');
  });
  it('no transforma documentos de origen documental en plazos', () => {
    render(el(RadarPlazos,{caseId:'fake',items:[{...item(),origen:'documento'}]}));
    expect(screen.getByText(/No hay plazos vencidos/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('conserva carga, bloqueo de doble envío y éxito', async () => {
    let resolve!: (value: {ok:true})=>void;
    vi.mocked(guardarPlazoDetectado).mockReturnValueOnce(new Promise(r=>{resolve=r}));
    render(el(RadarPlazos,{caseId:'fake',items:[item()]}));
    fireEvent.click(screen.getByRole('button',{name:'Cargar a agenda'}));
    const loading=screen.getByRole('button',{name:'Cargando…'}) as HTMLButtonElement;
    expect(loading.disabled).toBe(true);expect(loading.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(loading);expect(guardarPlazoDetectado).toHaveBeenCalledTimes(1);
    resolve({ok:true});
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('En agenda'));
  });
  for (const mode of ['response','exception']) it(`permite reintentar tras error ${mode}`,async()=>{
    if(mode==='response')vi.mocked(guardarPlazoDetectado).mockResolvedValueOnce({ok:false,motivo:'error'});
    else vi.mocked(guardarPlazoDetectado).mockRejectedValueOnce(new Error('Error de ensayo'));
    render(el(RadarPlazos,{caseId:'fake',items:[item()]}));
    fireEvent.click(screen.getByRole('button',{name:'Cargar a agenda'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Reintentar'})).toBeDefined());
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('En agenda'));
    expect(guardarPlazoDetectado).toHaveBeenCalledTimes(2);
  });
  it('usa caret vectorial de 16 px, sin el triángulo viejo en edición',()=>{
    const source=readFileSync('src/components/records/CaseFacts.tsx','utf8');
    expect(source).toContain('<CaretDown size={16}');expect(source).not.toContain('>▸</span>');
    expect(source).toContain('open={visibleFields.length === 0}');
    expect(source).toContain('form action={updateAction}');
    expect(source).toContain('htmlFor={`${idPrefix}-${field.key}`}');
  });
});
