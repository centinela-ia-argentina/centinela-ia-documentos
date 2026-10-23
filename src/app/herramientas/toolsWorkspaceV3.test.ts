/** @vitest-environment jsdom */
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ToolsWorkspace} from './ToolsWorkspace';
import {UnirPdf} from './UnirPdf';
import {UtilidadesTexto} from './UtilidadesTexto';
import {canUploadDocument} from '@/lib/permissions/roles';
vi.mock('@/app/documentos/actions',()=>({uploadDocument:vi.fn()}));
afterEach(cleanup);
const mount=()=>render(React.createElement(ToolsWorkspace,{eyebrow:'Herramientas inmobiliarias',tools:[React.createElement('input',{key:0,'aria-label':'Borrador local'}),React.createElement(UnirPdf,{key:1}),React.createElement('p',{key:2},'Compresor'),React.createElement('p',{key:3},'Conversor'),React.createElement(UtilidadesTexto,{key:4})]}));
it('muestra un único espacio y conserva el contenido al cambiar de herramienta',()=>{mount();fireEvent.change(screen.getByRole('textbox',{name:'Borrador local'}),{target:{value:'Conservar'}});fireEvent.click(screen.getByRole('button',{name:/Unir PDF Combiná/}));expect(screen.queryByRole('textbox',{name:'Borrador local'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:/Imagen → PDF Fotos/}));expect((screen.getByRole('textbox',{name:'Borrador local'}) as HTMLInputElement).value).toBe('Conservar');});
it('catálogo persistente y semántica de selección',()=>{mount();const nav=screen.getByRole('navigation',{name:'Catálogo de herramientas'});expect(nav.querySelectorAll('button')).toHaveLength(5);fireEvent.click(screen.getByRole('button',{name:/Convertir imágenes Formato/}));expect(nav.querySelector('[aria-current=true]')?.textContent).toContain('Convertir imágenes');expect(nav.querySelectorAll('[aria-current=true]')).toHaveLength(1);});
it('avisa que guardar envía archivo y PDF.js puede descargar un componente',()=>{mount();expect(screen.getByText(/Guardar en Documentos es una acción separada/).textContent).toContain('PDF.js');});
it('utilidades de texto usa controles explícitos',()=>{mount();fireEvent.click(screen.getByRole('button',{name:/Utilidades de texto Montos/}));fireEvent.click(screen.getByRole('button',{name:'Contador'}));expect(screen.getByRole('button',{name:'Contador'}).getAttribute('aria-pressed')).toBe('true');});
for(const role of ['admin','employee','auditor','client'] as const)it('permiso visual guardar PDF '+role,()=>{render(React.createElement(UnirPdf,{canSave:canUploadDocument(role)}));const input=document.querySelector('input[type=file]')!;fireEvent.change(input,{target:{files:[new File(['x'],'a.pdf',{type:'application/pdf'}),new File(['y'],'b.pdf',{type:'application/pdf'})]}});expect(!!screen.queryByRole('button',{name:'Guardar en Documentos'})).toBe(canUploadDocument(role));});
it('sin archivos no aparecen acciones de descarga ni guardado',()=>{render(React.createElement(UnirPdf));expect(screen.queryByRole('button',{name:'Guardar en Documentos'})).toBeNull();expect(screen.queryByRole('button',{name:/Descargar/})).toBeNull();});
