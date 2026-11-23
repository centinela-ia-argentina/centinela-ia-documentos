/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ClientRecord } from '@/types/client';
import { ClientesList } from './ClientesList';

const base = { id: 'fixture-id', name: 'Cliente de ejemplo', client_type: 'comprador', status: 'activo', zone: 'Palermo', operation_interest: 'compra', desired_property_type: 'departamento', budget_max: 190000, currency: 'USD', min_rooms: 3, phone: '+54 9 11 5555-0102', email: 'cliente@example.com' } as unknown as ClientRecord;
afterEach(cleanup);

function view(overrides: Partial<ClientRecord> = {}, props: Partial<Parameters<typeof ClientesList>[0]> = {}) {
  return render(React.createElement(ClientesList, {
    records: [{ ...base, ...overrides }],
    filters: { q: '', estado: undefined },
    basePath: '/clientes',
    totalActivos: 1,
    ...props,
  }));
}

describe('ClientesList · listado denso de cartera', () => {
  it('fila única con link de título y acción Ver ficha al href real', () => {
    view();
    expect(screen.getByRole('link', { name: 'Cliente de ejemplo' }).getAttribute('href')).toBe('/clientes/fixture-id');
    expect(screen.getAllByRole('link', { name: /Ver ficha:/ })).toHaveLength(1);
    expect(screen.getByText('Comprador')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
  });

  it('criterios de búsqueda y zona en la columna Búsqueda', () => {
    view();
    expect(screen.getByText('Compra · Departamento')).toBeTruthy();
    expect(screen.getByText('Palermo')).toBeTruthy();
  });

  it('datos en mono para presupuesto y fallback Sin definir', () => {
    const { container } = view();
    expect(screen.getByText('u$s 190.000')).toBeTruthy();
    expect(container.querySelector('[class*="mono"]')).not.toBeNull();
    const { container: missing } = view({ budget_max: null });
    expect(missing.querySelector('[class*="mono"]')).toBeNull();
    expect(screen.getByText('Sin definir')).toBeTruthy();
  });

  it.each([['activo','Activo'],['en_seguimiento','En seguimiento'],['cerrado','Cerrado'],['descartado','Descartado'],['custom','custom'],[null,'Sin definir']])('preserva etiqueta de estado %s', (status, label) => {
    const { container } = view({ status });
    const tag = container.querySelector('[class*="stateTag"]');
    expect(tag?.textContent).toBe(label);
  });

  it('fallbacks explícitos para datos incompletos', () => {
    view({ name: '', zone: null, operation_interest: null, desired_property_type: null, phone: null, email: null });
    expect(screen.getByRole('link', { name: 'Ver ficha: Cliente sin nombre' })).toBeTruthy();
    for (const text of ['Sin criterios específicos', 'Zona sin definir', 'Sin contacto registrado']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('ambientes mínimos no se muestran como columna vacía', () => {
    const { container } = view({ min_rooms: null });
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('segmentos de estado con aria-current y links al recorte', () => {
    view({}, { records: [base], filters: { q: '', estado: 'activo' }, basePath: '/clientes', totalActivos: 1 });
    const current = screen.getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('Activos');
    expect(current.getAttribute('href')).toBe('/clientes?estado=activo');
    expect(screen.getByRole('link', { name: 'Todos' }).getAttribute('href')).toBe('/clientes');
  });
  it('búsqueda GET con formulario al basePath y valor conservado', () => {
    view({}, { records: [base], filters: { q: 'martina', estado: 'activo' }, basePath: '/clientes', totalActivos: 1 });
    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/clientes');
    expect(form?.getAttribute('method')).toBe('get');
    const input = screen.getByPlaceholderText('Buscar por nombre, zona o contacto') as HTMLInputElement;
    expect(input.value).toBe('martina');
    expect(input.getAttribute('maxlength')).toBe('100');
    expect(screen.getByRole('link', { name: 'Limpiar búsqueda' }).getAttribute('href')).toBe('/clientes?estado=activo');
  });

  it('sin coincidencias explica el recorte sin declarar cartera vacía', () => {
    view({}, { records: [], filters: { q: 'zzz', estado: undefined }, basePath: '/clientes', totalActivos: 3 });
    expect(screen.getByRole('heading', { name: 'No hay coincidencias con este filtro' })).toBeTruthy();
    expect(screen.queryByText('Todavía no hay clientes registrados')).toBeNull();
    expect(screen.getByRole('link', { name: 'Limpiar filtros' }).getAttribute('href')).toBe('/clientes');
  });

  it('conserva contenido literal largo sin truncar', () => {
    const text = '<img src=x onerror=alert(1)> ' + 'Nombre largo '.repeat(30);
    const { container } = view({ name: text, phone: null, email: 'a'.repeat(120) + '@example.com' });
    const titleLink = screen.getAllByRole('link', { name: /Nombre largo/ }).find(l => l.getAttribute('href') === '/clientes/fixture-id');
    expect(titleLink?.textContent).toBe(text);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('a'.repeat(120) + '@example.com')).toBeTruthy();
  });
});
