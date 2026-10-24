/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { GenerarAvisoButton } from './[id]/GenerarAvisoButton';
import { TasarButton } from './[id]/TasarButton';
import { PropertyMatchAiButton } from './[id]/PropertyMatchAiButton';
vi.mock('./actions', () => ({ generarAvisoPropiedadIA:vi.fn(), tasarPropiedadConIA:vi.fn(), analizarMatchPropiedadIA:vi.fn() }));
import { generarAvisoPropiedadIA, tasarPropiedadConIA, analizarMatchPropiedadIA } from './actions';
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });
const read=(path:string)=>readFileSync(`src/${path}`,'utf8');
for(const [label,Component,action,button,resultTitle] of [
  ['aviso',GenerarAvisoButton,generarAvisoPropiedadIA,'Preparar aviso con IA','Aviso generado por IA'],
  ['tasación',TasarButton,tasarPropiedadConIA,'Preparar estimación con IA','Tasación por IA'],
  ['matching',PropertyMatchAiButton,analizarMatchPropiedadIA,'Analizar coincidencias con IA','Análisis de Candidatos (IA)'],
] as const)describe(`Propiedades V3 · ${label}`,()=>{
  it('no consulta IA al montar ni altera el identificador al solicitar',async()=>{
    vi.mocked(action).mockResolvedValue({ok:true,text:'Resultado ficticio para revisar'});
    render(React.createElement(Component,{propertyId:'propiedad-qa'}));
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:button}));
    await waitFor(()=>expect(screen.getByText(resultTitle)).toBeDefined());
    expect(action).toHaveBeenCalledTimes(1);expect(action).toHaveBeenCalledWith('propiedad-qa');
    expect(screen.getByText('Resultado ficticio para revisar').closest('[class*="aiTool"]')).not.toBeNull();
  });
  it('presenta el error sin inventar una respuesta',async()=>{
    vi.mocked(action).mockResolvedValue({ok:false,error:'Error de prueba'});
    render(React.createElement(Component,{propertyId:'propiedad-qa'}));
    fireEvent.click(screen.getByRole('button',{name:button}));
    await waitFor(()=>expect(screen.getByText('Error de prueba')).toBeDefined());
    expect(screen.queryByText(resultTitle)).toBeNull();expect(action).toHaveBeenCalledTimes(1);
  });
  it('permite ocultar el resultado sin ejecutar otra consulta',async()=>{
    vi.mocked(action).mockResolvedValue({ok:true,text:'Resultado ficticio para revisar'});
    render(React.createElement(Component,{propertyId:'propiedad-qa'}));
    fireEvent.click(screen.getByRole('button',{name:button}));
    await waitFor(()=>expect(screen.getByText(resultTitle)).toBeDefined());
    fireEvent.click(screen.getByTitle(/Ocultar|Cerrar/));
    expect(screen.getByRole('button',{name:button})).toBeDefined();expect(action).toHaveBeenCalledTimes(1);
  });
});
for(const path of ['app/copiloto/Copiloto.module.css','app/clientes/Clientes.module.css','app/propiedades/Propiedades.module.css','app/propiedades/[id]/PropertyDetail.module.css','app/propiedades/nueva/NewProperty.module.css','app/operaciones/nueva/NewOperation.module.css']){
 it(`frontera visual clara y local · ${path}`,()=>{
   const css=read(path);expect(css).toContain(path.includes('NewOperation')?'#92928f':'#d5d5d2');expect(css).toMatch(/focus-visible/);expect(css).not.toContain('PanelOutfit');
 });
}
it('los resultados opcionales tienen paleta legible y foco local',()=>{
 const css=read('app/propiedades/[id]/PropertyDetail.module.css');expect(css).toContain('.aiTool');expect(css).toContain('.aiTool pre');expect(css).toContain('.aiTool button:focus-visible');expect(css).toContain('.modal option');
});
it('mantiene indicadores circulares al apilar los pasos móviles',()=>{
 const css=read('app/operaciones/nueva/NewOperation.module.css');expect(css).toContain('Progreso de creación');expect(css).toContain('width:30px;min-width:30px;flex-shrink:0');
});
