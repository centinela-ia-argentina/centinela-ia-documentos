/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppButton, AppButtonLink, type AppButtonVariant } from './AppButton';
import { Surface, type SurfaceFamily } from './Surface';
import { Eyebrow, PageTitle, SectionTitle, SupportingCopy } from './Typography';
import { WorkflowStepper } from './WorkflowStepper';
import { SelectField } from './SelectField';

afterEach(cleanup);
const h = React.createElement;

describe('Reconstructed visual primitives', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as AppButtonVariant[])('supports %s without implicit submit', (variant) => {
    render(h(AppButton, { variant, disabled: true, 'aria-label': 'Acción' }, 'Acción'));
    const button = screen.getByRole('button');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.className).toContain('min-h-12');
    expect(button.className).toContain('focus-visible:ring-2');
  });
  it('preserves explicit submit and handlers', () => {
    const onClick = vi.fn();
    render(h(AppButton, { type: 'submit', onClick }, 'Crear'));
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
  it('preserves navigation as a link with approved appearance', () => {
    render(h(AppButtonLink, { href: '/operaciones', variant: 'secondary', appearance: 'navigation' }, 'Volver'));
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/operaciones');
    expect(link.className).toContain('w-fit');
    expect(link.className).toContain('bg-white/[0.045]');
  });
  it.each(['panel', 'secondary', 'row', 'interactive', 'callout'] as SurfaceFamily[])('supports the %s surface family', (family) => {
    render(h(Surface, { family, 'data-testid': 'surface', className: 'mt-6' }, 'Contenido'));
    expect(screen.getByTestId('surface').className).toContain('mt-6');
    expect(screen.getByTestId('surface').tagName).toBe('DIV');
  });
  it('preserves form semantics without wrappers', () => {
    render(h(Surface<'form'>, { as: 'form', action: '/test-only', 'aria-label': 'Formulario' }, h('input', { name: 'title', defaultValue: 'Prueba' })));
    const form = screen.getByRole('form');
    expect(form.tagName).toBe('FORM');
    expect(form.getAttribute('action')).toBe('/test-only');
    expect(new FormData(form as HTMLFormElement).get('title')).toBe('Prueba');
  });
  it('keeps heading semantics and the two approved font roles', () => {
    render(h('div', null, h(Eyebrow, null, 'Cartera'), h(PageTitle, null, 'Nueva'), h(SectionTitle, { id: 'section' }, 'Paso'), h(SupportingCopy, null, 'Ayuda')));
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('font-display');
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('section');
    expect(screen.getByText('Ayuda').className).toContain('font-ui');
  });
  it('keeps controlled step navigation, current and completed state', () => {
    const onStepChange = vi.fn();
    render(h(WorkflowStepper, { step: 2, onStepChange, steps: [{ id: 1, label: 'Operación', helper: 'Tipo' }, { id: 2, label: 'Vinculación', helper: 'Cliente' }, { id: 3, label: 'Condiciones', helper: 'Datos' }] }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
    expect(buttons[0].querySelector('svg')).not.toBeNull();
    fireEvent.click(buttons[2]);
    expect(onStepChange).toHaveBeenCalledWith(3);
  });
});

const options = [{ value: '', label: 'Sin definir' }, { value: 'USD', label: 'USD', detail: 'Moneda de referencia' }, { value: 'ARS', label: 'ARS' }];
const selectorProps = { name: 'case_metadata.moneda_operacion', label: 'Moneda', placeholder: 'Sin definir', options };
describe('Extracted SelectField', () => {
  it('opens, selects and submits the original field name and value', () => {
    const onChange = vi.fn();
    const { container } = render(h(SelectField, { ...selectorProps, onChange }));
    fireEvent.click(screen.getByRole('button', { name: 'Moneda' }));
    expect(screen.getByRole('listbox').getAttribute('aria-label')).toBe('Moneda');
    fireEvent.click(screen.getByRole('option', { name: /USD/ }));
    expect(onChange).toHaveBeenCalledWith('USD');
    expect(container.querySelector('input')?.value).toBe('USD');
    expect(container.querySelector('input')?.name).toBe('case_metadata.moneda_operacion');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('closes with Escape and returns focus to the trigger', () => {
    render(h(SelectField, selectorProps));
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    act(() => screen.getAllByRole('option')[1].focus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
  it('closes on outside click but not inside', () => {
    render(h(SelectField, selectorProps));
    fireEvent.click(screen.getByRole('button'));
    fireEvent.mouseDown(screen.getByRole('listbox'));
    expect(screen.queryByRole('listbox')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('honors controlled state instead of internally replacing it', () => {
    const onChange = vi.fn();
    const view = render(h(SelectField, { ...selectorProps, value: 'USD', onChange }));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: /USD/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'ARS' }));
    expect(view.container.querySelector('input')?.value).toBe('USD');
    view.rerender(h(SelectField, { ...selectorProps, value: 'ARS', onChange }));
    expect(view.container.querySelector('input')?.value).toBe('ARS');
  });
  it('cleans up document listeners when unmounted', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const view = render(h(SelectField, selectorProps));
    fireEvent.click(screen.getByRole('button'));
    view.unmount();
    expect(remove.mock.calls.some(([event]) => event === 'mousedown')).toBe(true);
    expect(remove.mock.calls.some(([event]) => event === 'keydown')).toBe(true);
    remove.mockRestore();
  });
});

describe('SelectField keyboard contract', () => {
  it('opens on ArrowDown and focuses the selected option', () => {
    render(h(SelectField, { ...selectorProps, defaultValue: 'USD' }));
    const trigger = screen.getByRole('button', { name: 'Moneda' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /USD/ }));
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
  });
  it('supports arrows and Home/End without changing the field value', () => {
    const { container } = render(h(SelectField, selectorProps));
    fireEvent.click(screen.getByRole('button', { name: 'Moneda' }));
    const items = screen.getAllByRole('option');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'End' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    expect(container.querySelector('input')?.value).toBe('');
    expect(items.filter((item) => item.tabIndex === 0)).toEqual([items[0]]);
  });
  it('returns focus after mouse selection', () => {
    render(h(SelectField, selectorProps));
    const trigger = screen.getByRole('button', { name: 'Moneda' });
    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: /USD/ });
    act(() => option.focus());
    fireEvent.click(option);
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('keeps Tab native and closes once focus leaves the selector', () => {
    render(h('div', null, h(SelectField, selectorProps), h('button', null, 'Después')));
    fireEvent.click(screen.getByRole('button', { name: 'Moneda' }));
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    screen.getAllByRole('option')[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    act(() => screen.getByRole('button', { name: 'Después' }).focus());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Después' }));
  });
  it('opens with ArrowUp when no value matches and tolerates no options', () => {
    const view = render(h(SelectField, { ...selectorProps, defaultValue: 'missing' }));
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getAllByRole('option')[2]);
    view.unmount();
    render(h(SelectField, { ...selectorProps, options: [] }));
    const trigger = screen.getByRole('button');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
