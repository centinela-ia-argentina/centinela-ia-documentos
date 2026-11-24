/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PropertyRecord } from '@/types/property';
import { PropiedadesList } from './PropiedadesList';

const base = { id: 'fixture-id', name: 'Propiedad de ejemplo', property_type: 'departamento', status: 'disponible', address: 'Dirección ficticia', price: 185000, currency: 'USD', surface_total_m2: 82 } as PropertyRecord;
afterEach(cleanup);

function view(overrides: Partial<PropertyRecord> = {}, props: Partial<Parameters<typeof PropiedadesList>[0]> = {}) {
  return render(React.createElement(PropiedadesList, {
    records: [{ ...base, ...overrides }],
    filters: { q: '', estado: undefined },
    basePath: '/propiedades',
    totalActivas: 1,
    ...props,
  }));
}

describe('PropiedadesList · listado denso de cartera', () => {
  it('fila única con link de título y acción Ver ficha al href real', () => {
    view();
    expect(screen.getByRole('link', { name: 'Propiedad de ejemplo' }).getAttribute('href')).toBe('/propiedades/fixture-id');
    expect(screen.getByRole('link', { name: 'Ver ficha: Propiedad de ejemplo' }).getAttribute('href')).toBe('/propiedades/fixture-id');
    expect(screen.getAllByRole('link', { name: /Ver ficha:/ })).toHaveLength(1);
    expect(screen.getByText('Departamento')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
  });

  it('datos en formato aprobado y reserva de mono para montos', () => {
    const { container } = view();
    expect(screen.getByText('u$s 185.000')).toBeTruthy();
    expect(screen.getByText('82 m²')).toBeTruthy();
    expect(container.querySelector('[class*="mono"]')).not.toBeNull();
  });

  it.each([['disponible','Disponible'],['reservada','Reservada'],['vendida','Vendida'],['alquilada','Alquilada'],['no_disponible','No disponible'],['custom','custom'],[null,'Sin definir']])('preserva etiqueta de estado %s', (status, label) => { view({ status }); expect(screen.getByText(label!)).toBeTruthy(); });

  it('no trata precio ni superficie en cero como faltantes', () => {
    view({ price: 0, surface_total_m2: 0, currency: 'ARS' });
    expect(screen.getByText('$ 0')).toBeTruthy();
    expect(screen.getByText('0 m²')).toBeTruthy();
    expect(screen.queryByText('Precio no cargado')).toBeNull();
  });

  it('fallbacks explícitos para datos incompletos, sin inventar', () => {
    view({ name: '', address: null, property_type: null, status: null, price: null, surface_total_m2: null });
    expect(screen.getByRole('link', { name: 'Ver ficha: Propiedad sin nombre' })).toBeTruthy();
    for (const text of ['Dirección no cargada', 'Precio no cargado', 'No cargada']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('conserva contenido literal largo sin truncar ni interpretar HTML', () => {
    const text = '<img src=x onerror=alert(1)> ' + 'Nombre largo '.repeat(30);
    const address = 'Dirección '.repeat(50);
    const { container } = view({ name: text, address });
    const titleLink = screen.getAllByRole('link', { name: /Nombre largo/ }).find(l => l.getAttribute('href') === '/propiedades/fixture-id');
    expect(titleLink?.textContent).toBe(text);
    expect(screen.getByText(address.trim())).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('segmentos de estado con aria-current y links al recorte', () => {
    view({}, { records: [base], filters: { q: '', estado: 'disponible' }, basePath: '/propiedades', totalActivas: 1 });
    const current = screen.getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('Disponibles');
    expect(current.getAttribute('href')).toBe('/propiedades?estado=disponible');
    expect(screen.getByRole('link', { name: 'Todas' }).getAttribute('href')).toBe('/propiedades');
  });

  it('búsqueda GET con formulario al basePath y valor conservado', () => {
    view({}, { records: [base], filters: { q: 'palermo', estado: 'disponible' }, basePath: '/propiedades', totalActivas: 1 });
    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/propiedades');
    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.querySelector('input[name="estado"]')?.getAttribute('value')).toBe('disponible');
    const input = screen.getByPlaceholderText('Buscar por nombre o dirección') as HTMLInputElement;
    expect(input.value).toBe('palermo');
    expect(input.getAttribute('maxlength')).toBe('100');
    expect(screen.getByRole('link', { name: 'Limpiar búsqueda' }).getAttribute('href')).toBe('/propiedades?estado=disponible');
  });

  it('sin coincidencias explica el recorte sin declarar cartera vacía', () => {
    view({}, { records: [], filters: { q: 'zzz', estado: undefined }, basePath: '/propiedades', totalActivas: 3 });
    expect(screen.getByRole('heading', { name: 'No hay coincidencias con este filtro' })).toBeTruthy();
    expect(screen.queryByText('Todavía no hay propiedades cargadas')).toBeNull();
    expect(screen.getByRole('link', { name: 'Limpiar filtros' }).getAttribute('href')).toBe('/propiedades');
  });

  it('resumen de cartera con total de la vista', () => {
    view({}, { records: [base], filters: { q: '', estado: undefined }, basePath: '/propiedades', totalActivas: 5 });
    expect(screen.getByText('1 de 5 propiedades')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Propiedades en la cartera' })).toBeTruthy();
  });
});
