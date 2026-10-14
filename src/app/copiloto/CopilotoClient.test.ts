/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('./actions', () => ({ generarBriefing: vi.fn(), preguntarCopiloto: vi.fn() }));
import { generarBriefing, preguntarCopiloto } from './actions';
import { CopilotoClient } from './CopilotoClient';
const h = React.createElement;
const generate = vi.mocked(generarBriefing);
const ask = vi.mocked(preguntarCopiloto);
const summary = { panorama: 'Lectura ficticia', prioridades: ['Prioridad de ejemplo'], alertas: ['Alerta de ejemplo'], oportunidades: ['Oportunidad de ejemplo'] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in component tests'); }));
  generate.mockResolvedValue({ ok: true, model: 'fixture', briefing: summary });
  ask.mockResolvedValue({ ok: true, model: 'fixture', respuesta: 'Respuesta ficticia' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(allowed = true) { return render(h(CopilotoClient, { canUsePortfolioAi: allowed })); }
function open() { fireEvent.click(screen.getByRole('button', { name: 'Abrir asistente IA' })); }
function chat() { fireEvent.click(screen.getByRole('tab', { name: 'Consultas de cartera' })); }
function draft(text = '  pregunta ficticia  ') { fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), { target: { value: text } }); }
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

describe('Portfolio AI presentation', () => {
  it('uses a simple horizontal toggle arrow without changing the accessible name', () => {
    setup(); const trigger = screen.getByRole('button', { name: 'Abrir asistente IA' });
    const arrow = trigger.querySelector('svg.lucide-arrow-right');
    expect(arrow).toBeTruthy(); expect(arrow?.getAttribute('aria-hidden')).toBe('true');
    open(); expect(screen.getByRole('button', { name: 'Cerrar asistente IA' }).querySelector('svg.lucide-arrow-right')).toBeTruthy();
    expect(generate).not.toHaveBeenCalled(); expect(ask).not.toHaveBeenCalled();
  });
  it('keeps decorative icons hidden from the two tab names', () => {
    setup(); open();
    for (const name of ['Resumen de cartera', 'Consultas de cartera']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('starts closed with an explicit linked expansion control', () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Abrir asistente IA' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)?.hidden).toBe(true);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(generate).not.toHaveBeenCalled(); expect(ask).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('opening and changing views never generate or ask', () => {
    setup(); open(); chat(); fireEvent.click(screen.getByRole('tab', { name: 'Resumen de cartera' }));
    expect(generate).not.toHaveBeenCalled(); expect(ask).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('closes while keeping focus on the same expansion control', () => {
    setup(); open(); const close = screen.getByRole('button', { name: 'Cerrar asistente IA' }); close.focus(); fireEvent.click(close);
    expect(close.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(close);
  });
  it('has one selected, linked tab and panel at a time', () => {
    setup(); open(); chat(); const tab = screen.getByRole('tab', { name: 'Consultas de cartera' });
    expect(tab.getAttribute('aria-selected')).toBe('true'); expect(tab.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: 'Resumen de cartera' }).tabIndex).toBe(-1);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel').id).toBe(tab.getAttribute('aria-controls'));
  });
  it.each(['ArrowRight', 'ArrowLeft', 'End'])('%s selects and focuses chat from summary', (key) => {
    setup(); open(); const tab = screen.getByRole('tab', { name: 'Resumen de cartera' }); tab.focus(); fireEvent.keyDown(tab, { key });
    const next = screen.getByRole('tab', { name: 'Consultas de cartera' }); expect(document.activeElement).toBe(next); expect(next.getAttribute('aria-selected')).toBe('true');
  });
  it('Home returns to the summary with focus', () => {
    setup(); open(); chat(); fireEvent.keyDown(screen.getByRole('tab', { name: 'Consultas de cartera' }), { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Resumen de cartera' }));
  });
  it('read-only capability has no IA controls and makes no calls', () => {
    setup(false); expect(screen.getByRole('heading', { name: 'Vista de consulta' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull(); expect(screen.queryByRole('textbox')).toBeNull();
    expect(generate).not.toHaveBeenCalled(); expect(ask).not.toHaveBeenCalled();
  });
  it('disabling capability during a request does not reveal controls', async () => {
    const request = deferred<Awaited<ReturnType<typeof generarBriefing>>>(); generate.mockReturnValue(request.promise);
    const v = setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' }));
    v.rerender(h(CopilotoClient, { canUsePortfolioAi: false })); await act(async () => request.resolve({ ok: true, model: 'fixture', briefing: summary }));
    expect(screen.queryByRole('button')).toBeNull(); expect(screen.queryByText('Lectura ficticia')).toBeNull();
  });
  it('generates only explicitly and keeps all four summary sections', async () => {
    setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' }));
    expect(await screen.findByText('Lectura ficticia')).toBeTruthy(); expect(generate).toHaveBeenCalledTimes(1);
    for (const name of ['Panorama', 'Prioridades sugeridas', 'Alertas sugeridas', 'Oportunidades sugeridas']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regenerar resumen' })).toBeTruthy();
  });
  it('conserves the summary across views and collapse', async () => {
    setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' })); await screen.findByText('Lectura ficticia'); chat();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar asistente IA' })); open(); fireEvent.click(screen.getByRole('tab', { name: 'Resumen de cartera' }));
    expect(screen.getByText('Lectura ficticia')).toBeTruthy(); expect(generate).toHaveBeenCalledTimes(1);
  });
  it('prevents duplicate summary requests in the same event turn', async () => {
    const request = deferred<Awaited<ReturnType<typeof generarBriefing>>>(); generate.mockReturnValue(request.promise);
    setup(); open(); const button = screen.getByRole('button', { name: 'Generar resumen' });
    act(() => { button.click(); button.click(); }); expect(generate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Generando…' }).hasAttribute('disabled')).toBe(true);
    await act(async () => request.resolve({ ok: true, model: 'fixture', briefing: summary }));
  });
  it.each([
    ['sin_api_key', 'La asistencia con IA no está configurada. Contactá al administrador.'],
    ['sin_datos', 'Todavía no hay datos suficientes. Cargá propiedades, operaciones o clientes.'],
    ['sin_permiso', 'Tu cuenta no tiene permiso para usar la asistencia con IA.'],
    ['sin_sesion', 'Tu sesión no está disponible. Volvé a ingresar.'],
    ['error', 'No se pudo generar el resumen. Probá de nuevo en un momento.'],
  ])('shows summary outcome %s as an alert', async (reason, text) => {
    generate.mockResolvedValue({ ok: false, motivo: reason } as Awaited<ReturnType<typeof generarBriefing>>);
    setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' })); expect((await screen.findByRole('alert')).textContent).toContain(text);
  });
  it('handles a rejected summary and preserves the prior successful summary', async () => {
    setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' })); await screen.findByText('Lectura ficticia');
    generate.mockRejectedValueOnce(new Error('fixture failure')); fireEvent.click(screen.getByRole('button', { name: 'Regenerar resumen' }));
    expect(await screen.findByRole('alert')).toBeTruthy(); expect(screen.getByText('Lectura ficticia')).toBeTruthy();
  });
  it('does not show empty suggested sections or render summary HTML as markup', async () => {
    generate.mockResolvedValue({ ok: true, model: 'fixture', briefing: { panorama: '<img src=x onerror=alert(1)>', prioridades: [], alertas: [], oportunidades: [] } });
    const { container } = setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' }));
    await screen.findByText('<img src=x onerror=alert(1)>'); expect(container.querySelector('img')).toBeNull(); expect(screen.queryByRole('heading', { name: 'Prioridades sugeridas' })).toBeNull();
  });
  it('all four suggestions fill the editor without calling IA', () => {
    setup(); open(); chat(); const suggestions = screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('¿'));
    expect(suggestions).toHaveLength(4);
    for (const b of suggestions) { fireEvent.click(b); expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(b.textContent); expect(document.activeElement).toBe(screen.getByRole('textbox')); }
    expect(ask).not.toHaveBeenCalled();
  });
  it('does not send an empty or whitespace question', () => {
    setup(); open(); chat(); draft('   '); fireEvent.submit(screen.getByRole('form', { name: 'Consultar la cartera' }));
    expect(ask).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Consultar' }).hasAttribute('disabled')).toBe(true);
  });
  it('trims explicit sends and shows labelled messages', async () => {
    setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Respuesta ficticia')).toBeTruthy(); expect(ask).toHaveBeenCalledWith('pregunta ficticia');
    expect(screen.getByRole('log', { name: 'Conversación de cartera' }).textContent).toContain('Vos');
    expect(screen.getByRole('log').textContent).toContain('Asistente IA');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
  it('Enter sends and Shift+Enter does not', async () => {
    setup(); open(); chat(); draft('consulta'); const input = screen.getByRole('textbox'); fireEvent.keyDown(input, { key: 'Enter', shiftKey: true }); expect(ask).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' }); await screen.findByText('Respuesta ficticia'); expect(ask).toHaveBeenCalledTimes(1);
  });
  it.each([{ isComposing: true }, { keyCode: 229 }])('does not submit Enter during IME composition %j', (flags) => {
    setup(); open(); chat(); draft(); fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ...flags }); expect(ask).not.toHaveBeenCalled();
  });
  it('prevents duplicate question submissions and keeps the pending status', async () => {
    const request = deferred<Awaited<ReturnType<typeof preguntarCopiloto>>>(); ask.mockReturnValue(request.promise);
    setup(); open(); chat(); draft('consulta'); const form = screen.getByRole('form');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); }); expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Preparando respuesta');
    await act(async () => request.resolve({ ok: true, model: 'fixture', respuesta: 'Terminó' }));
  });
  it('preserves draft, selected view and messages when collapsed', async () => {
    setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); await screen.findByText('Respuesta ficticia'); draft('siguiente pregunta');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar asistente IA' })); open();
    expect(screen.getByRole('tab', { name: 'Consultas de cartera' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('siguiente pregunta'); expect(screen.getByText('Respuesta ficticia')).toBeTruthy();
  });
  it.each([
    ['sin_api_key', 'no está configurada'], ['sin_pregunta', 'Escribí una pregunta.'], ['sin_permiso', 'no tiene permiso'], ['sin_sesion', 'Volvé a ingresar'], ['error', 'No pude responder'],
  ])('shows question failure %s outside IA messages', async (reason, text) => {
    ask.mockResolvedValue({ ok: false, motivo: reason } as Awaited<ReturnType<typeof preguntarCopiloto>>);
    setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect((await screen.findByRole('alert')).textContent).toContain(text); expect(screen.getByRole('log').textContent).not.toContain(text);
  });
  it('recovers after a rejected question', async () => {
    ask.mockRejectedValueOnce(new Error('fixture failure')); setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); await screen.findByRole('alert');
    draft('otra'); fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); await screen.findByText('Respuesta ficticia'); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps long answers as text, never HTML markup', async () => {
    const text = '<script>fixture</script>' + 'TextoSinEspacios'.repeat(100); ask.mockResolvedValue({ ok: true, model: 'fixture', respuesta: text });
    const { container } = setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); await screen.findByText(text); expect(container.querySelector('script')).toBeNull();
  });
  it('ignores a summary response after unmount', async () => {
    const request = deferred<Awaited<ReturnType<typeof generarBriefing>>>(); generate.mockReturnValue(request.promise); const v = setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Generar resumen' })); v.unmount();
    await act(async () => request.resolve({ ok: true, model: 'fixture', briefing: summary })); expect(screen.queryByText('Lectura ficticia')).toBeNull();
  });
  it('ignores a chat response after unmount', async () => {
    const request = deferred<Awaited<ReturnType<typeof preguntarCopiloto>>>(); ask.mockReturnValue(request.promise); const v = setup(); open(); chat(); draft(); fireEvent.click(screen.getByRole('button', { name: 'Consultar' })); v.unmount();
    await act(async () => request.resolve({ ok: true, model: 'fixture', respuesta: 'Fixture' })); expect(screen.queryByText('Fixture')).toBeNull();
  });
});
