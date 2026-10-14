/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const push = vi.hoisted(() => vi.fn());
vi.mock('./creationAction', () => ({ createNewProperty: vi.fn() }));
import { createNewProperty } from './creationAction';
import { NewPropertyForm } from './NewPropertyForm';
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); vi.mocked(createNewProperty).mockResolvedValue({ error: 'Fixture insertion error; draft retained', field: null }); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden'); })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('approved new property UI and safe creation draft', () => {
  it('keeps unique 17 fields, associated labels, defaults and name-only requirement', () => {
    const { container } = render(React.createElement(NewPropertyForm)); const names = Array.from(container.querySelectorAll('[name]')).map(e => e.getAttribute('name')); expect(names).toHaveLength(17); expect(new Set(names).size).toBe(17);
    expect(container.querySelectorAll('[required]')).toHaveLength(1); expect((container.querySelector('[name=status]') as HTMLInputElement).value).toBe('disponible'); expect((container.querySelector('[name=currency]') as HTMLInputElement).value).toBe('USD'); expect((container.querySelector('[name=property_type]') as HTMLInputElement).value).toBe('');
    for (const el of container.querySelectorAll<HTMLInputElement>('input:not([type=hidden]),textarea')) expect(el.labels?.length).toBe(1); expect(screen.queryByText('IA')).toBeNull(); expect(createNewProperty).not.toHaveBeenCalled();
  });
  it('uses existing selector keyboard, choices and focus-return without new defaults', () => {
    render(React.createElement(NewPropertyForm)); const t = screen.getByRole('button', { name: 'Tipo' }); fireEvent.keyDown(t, { key: 'ArrowDown' }); fireEvent.keyDown(document.activeElement!, { key: 'End' }); expect(document.activeElement?.textContent).toContain('Otro'); fireEvent.click(document.activeElement!); expect((document.querySelector('[name=property_type]') as HTMLInputElement).value).toBe('otro'); expect(document.activeElement).toBe(t); fireEvent.click(screen.getByRole('button', { name: 'Estado' })); expect(screen.getByRole('option', { name: /No disponible/ })).toBeTruthy(); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('clean cancel returns to existing list without confirmation', () => { render(React.createElement(NewPropertyForm)); fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(window.confirm).not.toHaveBeenCalled(); expect(push).toHaveBeenCalledWith('/propiedades'); });
  it('dirty cancel can be rejected without dropping values, then confirmed', () => {
    render(React.createElement(NewPropertyForm)); fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la propiedad *' }), { target: { value: 'Fixture draft' } }); vi.mocked(window.confirm).mockReturnValueOnce(false); fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(push).not.toHaveBeenCalled(); expect((screen.getByRole('textbox', { name: 'Nombre de la propiedad *' }) as HTMLInputElement).value).toBe('Fixture draft'); fireEvent.click(screen.getByRole('button', { name: 'Volver a propiedades' })); expect(push).toHaveBeenCalledWith('/propiedades'); expect(createNewProperty).not.toHaveBeenCalled();
  });
  it('unload warning exists only for dirty drafts and cleans up on unmount', () => {
    const r = render(React.createElement(NewPropertyForm)); const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false); fireEvent.change(screen.getByRole('textbox', { name: 'Dirección' }), { target: { value: 'Fixture' } }); const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true); r.unmount(); const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after); expect(after.defaultPrevented).toBe(false);
  });
  it('safe errors preserve controlled decimal/zero draft, focus alert, and allow retry', async () => {
    render(React.createElement(NewPropertyForm)); fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la propiedad *' }), { target: { value: 'Fixture' } }); fireEvent.change(screen.getByRole('spinbutton', { name: 'Superficie total (m²)' }), { target: { value: '82.50' } }); fireEvent.change(screen.getByRole('spinbutton', { name: 'Ambientes' }), { target: { value: '0' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar propiedad' })); const alert = await screen.findByRole('alert'); expect(alert).toBe(document.activeElement); expect((screen.getByRole('spinbutton', { name: 'Superficie total (m²)' }) as HTMLInputElement).value).toBe('82.50'); expect((screen.getByRole('spinbutton', { name: 'Ambientes' }) as HTMLInputElement).value).toBe('0'); expect(vi.mocked(createNewProperty).mock.calls[0][1].get('surface_total_m2')).toBe('82.50'); fireEvent.click(screen.getByRole('button', { name: 'Guardar propiedad' })); await waitFor(() => expect(createNewProperty).toHaveBeenCalledTimes(2)); expect(fetch).not.toHaveBeenCalled();
  });
  it('pending disables all inputs/selectors/save/cancel until result', async () => {
    let resolve!: (result: { error: string; field: null }) => void; vi.mocked(createNewProperty).mockImplementation(() => new Promise(r => { resolve = r; })); render(React.createElement(NewPropertyForm)); fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la propiedad *' }), { target: { value: 'Fixture' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar propiedad' })); await screen.findByRole('button', { name: 'Guardando…' }); expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true); expect(document.querySelectorAll('fieldset:disabled')).toHaveLength(4); expect(screen.getByRole('button', { name: 'Tipo' }).closest('fieldset')?.disabled).toBe(true); resolve({ error: 'Safe fixture error', field: null }); await screen.findByRole('alert'); expect((screen.getByRole('button', { name: 'Guardar propiedad' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
