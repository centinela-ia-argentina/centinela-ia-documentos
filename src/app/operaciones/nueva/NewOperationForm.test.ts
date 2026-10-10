/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseFieldsByIndustry, caseStatusesByIndustry, caseTypesByIndustry } from '@/lib/industries/caseConfig';
import { createCase } from '@/app/expedientes/actions';
import { NewOperationForm } from './NewOperationForm';
vi.mock('@/app/expedientes/actions', () => ({ createCase: vi.fn() }));
vi.mock('next/link', () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  const view = render(React.createElement(NewOperationForm, {
    caseFields: caseFieldsByIndustry.inmobiliaria,
    caseStatuses: caseStatusesByIndustry.inmobiliaria,
    caseTypes: caseTypesByIndustry.inmobiliaria,
    properties: [{ id: 'qa-property-only', name: 'Propiedad QA Test' }],
  }));
  const payload = () => new FormData(view.container.querySelector('form')!);
  return { ...view, payload };
}
function select(label: string, option: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}
function complete() {
  fireEvent.change(screen.getByTestId('case-title'), { target: { value: 'Operación QA' } });
  fireEvent.click(screen.getByRole('radio', { name: /Alquiler/ }));
  select('Estado inicial', /Disponible/);
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByTestId('case-client'), { target: { value: 'Cliente QA' } });
  select('Propiedad asociada', /Propiedad QA Test/);
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByLabelText('Dirección del inmueble'), { target: { value: 'Dirección QA' } });
  fireEvent.change(screen.getByLabelText('Cliente / contraparte'), { target: { value: 'Contraparte QA' } });
  fireEvent.change(screen.getByLabelText('Valor de la operación'), { target: { value: '120000' } });
  fireEvent.change(screen.getByLabelText('Fecha relevante'), { target: { value: '2026-10-15' } });
  select('Moneda de la operación', /USD/);
  select('Nivel de sensibilidad', /Alta/);
}
const expected = {
  title: 'Operación QA', case_type: 'Alquiler', status: 'active', client_name: 'Cliente QA', property_id: 'qa-property-only',
  'case_metadata.direccion_inmueble': 'Dirección QA', 'case_metadata.contraparte': 'Contraparte QA',
  'case_metadata.valor_operacion': '120000', 'case_metadata.fecha_relevante': '2026-10-15',
  'case_metadata.moneda_operacion': 'USD', 'case_metadata.sensibilidad': 'Alta',
};
function checkPayload(data: FormData) {
  for (const [key, value] of Object.entries(expected)) expect(data.getAll(key), key).toEqual([value]);
}
describe('New operation multi-step payload regression', () => {
  it('uses a different DOM button for navigation and creation', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const continueButton = screen.getByRole('button', { name: 'Continuar' });
    expect(continueButton.getAttribute('type')).toBe('button');
    fireEvent.click(continueButton);
    const createButton = screen.getByTestId('case-submit');
    expect(createButton).not.toBe(continueButton);
    expect(continueButton.isConnected).toBe(false);
    expect(createButton.getAttribute('type')).toBe('submit');
    expect(createCase).not.toHaveBeenCalled();
  });
  it('preserves navigation focus when the final button is remounted', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const continueButton = screen.getByRole('button', { name: 'Continuar' });
    continueButton.focus();
    fireEvent.click(continueButton);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('case-submit')));
    expect(createCase).not.toHaveBeenCalled();
  });
  it('does not invoke creation while advancing a populated operation', () => {
    setup(); complete();
    expect(screen.getByTestId('case-submit')).toBeTruthy();
    expect(createCase).not.toHaveBeenCalled();
  });
  it('sends the complete payload to the unchanged server action', async () => {
    const view = setup(); complete();
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(createCase).toHaveBeenCalledOnce());
    checkPayload(vi.mocked(createCase).mock.calls[0][0]);
  });
  it('does not submit a blank required title from a later step', () => {
    const view = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.submit(view.container.querySelector('form')!);
    expect(createCase).not.toHaveBeenCalled();
    expect(screen.getByTestId('case-title')).toBeTruthy();
  });
  it('serializes all steps exactly once at submission', () => {
    const view = setup(); complete(); checkPayload(view.payload());
  });
  it('preserves conditions when navigating backwards and forwards', () => {
    const view = setup(); complete();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' })); checkPayload(view.payload());
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' })); checkPayload(view.payload());
    expect((screen.getByTestId('case-title') as HTMLInputElement).value).toBe('Operación QA');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByTestId('case-client') as HTMLInputElement).value).toBe('Cliente QA');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' })); checkPayload(view.payload());
    expect((screen.getByLabelText('Fecha relevante') as HTMLInputElement).value).toBe('2026-10-15');
  });
  it('keeps optional fields empty and configured defaults without duplicate entries', () => {
    const view = setup(); fireEvent.change(screen.getByTestId('case-title'), { target: { value: 'Mínima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const data = view.payload();
    expect(data.getAll('title')).toEqual(['Mínima']);
    expect(data.getAll('case_type')).toEqual([caseTypesByIndustry.inmobiliaria[0]]);
    expect(data.getAll('status')).toEqual([caseStatusesByIndustry.inmobiliaria[0].value]);
    for (const key of ['client_name', 'property_id', ...caseFieldsByIndustry.inmobiliaria.map(f => `case_metadata.${f.key}`)]) expect(data.getAll(key)).toEqual(['']);
  });
});
