/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PropertyRecord } from '@/types/property';
import { PropiedadCard } from './PropiedadCard';
const fixture = { id: 'fixture-id', name: 'Propiedad de ejemplo', property_type: 'departamento', status: 'disponible', address: 'Dirección ficticia', price: 185000, currency: 'USD', surface_total_m2: 82 } as PropertyRecord;
afterEach(cleanup);
function card(overrides: Partial<PropertyRecord> = {}) { return render(React.createElement(PropiedadCard, { property: { ...fixture, ...overrides } })); }
describe('PropiedadCard presentation', () => {
  it('is a single link to the real property route, without nested buttons', () => {
    const { container } = card();
    expect(screen.getByRole('link', { name: 'Ver ficha: Propiedad de ejemplo' }).getAttribute('href')).toBe('/propiedades/fixture-id');
    expect(screen.getAllByRole('link')).toHaveLength(1); expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Ver ficha')).toBeTruthy(); expect(container.querySelector('svg.lucide-arrow-right')).toBeTruthy();
  });
  it.each(['departamento','casa','local','oficina','lote/terreno','lote','terreno','cochera','otro','unknown',null])('provides a decorative type icon for %s', (property_type) => {
    const { container } = card({ property_type });
    expect(container.querySelector('[data-property-type] svg')).toBeTruthy();
    for (const svg of container.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
  it.each([['disponible','Disponible'],['reservada','Reservada'],['vendida','Vendida'],['alquilada','Alquilada'],['no_disponible','No disponible'],['custom','custom'],[null,'Sin definir']])('preserves label for state %s', (status, label) => { card({ status }); expect(screen.getByText(label!)).toBeTruthy(); });
  it('matches icon variants case-insensitively without changing labels', () => { card({ property_type: 'CASA', status: 'RESERVADA' }); expect(screen.getByText('Casa')).toBeTruthy(); expect(screen.getByText('Reservada')).toBeTruthy(); });
  it('preserves existing monetary formatting and adds only missing-data labels', () => { card(); expect(screen.getByText('u$s 185.000')).toBeTruthy(); expect(screen.getByText('82 m²')).toBeTruthy(); });
  it('does not treat zero price or surface as missing', () => { card({ price: 0, surface_total_m2: 0, currency: 'ARS' }); expect(screen.getByText('$ 0')).toBeTruthy(); expect(screen.getByText('0 m²')).toBeTruthy(); expect(screen.queryByText('Precio no cargado')).toBeNull(); });
  it('shows fallbacks for incomplete data', () => { card({ name: '', address: null, property_type: null, status: null, price: null, surface_total_m2: null }); expect(screen.getByRole('link',{name:'Ver ficha: Propiedad sin nombre'})).toBeTruthy(); for(const text of ['Dirección no cargada','Precio no cargado','Superficie no cargada']) expect(screen.getByText(text)).toBeTruthy(); expect(screen.getAllByText('Sin definir')).toHaveLength(2); });
  it('retains literal long content without adding HTML or truncating data', () => { const text = '<img src=x onerror=alert(1)> ' + 'Nombre largo '.repeat(30); const address='Dirección '.repeat(50); const {container}=card({name:text,address});expect(screen.getByRole('heading').textContent).toBe(text);expect(screen.getByText(address.trim())).toBeTruthy();expect(container.querySelector('img')).toBeNull(); });
  it('does not expose other property fields as card content', () => { card({ notes:'private fixture notes', owners:'private fixture owner',matricula:'private fixture registration' }); expect(screen.queryByText(/private fixture/)).toBeNull(); });
});
