/** @vitest-environment jsdom */
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaseAgentDisclosure } from './CaseAgentDisclosure';
import { ClientDetailMode } from './ClientDetailMode';
import { ClientDetailReadView, MatchStatus } from './ClientDetailReadView';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { AgenteChat } from '@/app/expedientes/[id]/AgenteChat';
import { evaluarMatch } from '@/lib/matching/match';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';

vi.mock('@/app/whatsappActions', () => ({ logWhatsAppAction: vi.fn() }));
vi.mock('@/app/expedientes/[id]/agenteActions', () => ({ diagnosticoLegajo: vi.fn().mockResolvedValue({ ok: true, alertas: [] }), preguntarAgente: vi.fn(), ejecutarAccionAgente: vi.fn() }));
import { diagnosticoLegajo } from '@/app/expedientes/[id]/agenteActions';

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const el = React.createElement;
const record = { id: 'c1', name: 'Lucía Fernández', organization_id: 'o1', status: 'activo', client_type: 'comprador', currency: 'USD', budget_min: 0, budget_max: 120000, min_rooms: 2, desired_property_type: 'departamento', operation_interest: 'compra', desired_province: 'Buenos Aires', desired_subzone: 'Plaza Moreno' } as ClientRecord;
const property = { id: 'p1', name: 'Plaza Moreno', status: 'disponible', currency: 'USD', property_type: 'departamento', price: 112000, rooms: 2 } as PropertyRecord;

describe('Consulta del agente a demanda', () => {
  it('no monta hasta la apertura, conserva instancia y borrador al contraer', () => {
    const mounted = vi.fn(), unmounted = vi.fn();
    function Child() { useEffect(() => { mounted(); return unmounted; }, []); return el('textarea', { 'aria-label': 'Borrador' }); }
    render(el(CaseAgentDisclosure, { canUseAi: true, children: el(Child) }));
    expect(mounted).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: /Consultar al agente/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(mounted).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Consulta pendiente' } });
    fireEvent.click(toggle); fireEvent.click(toggle);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Consulta pendiente');
    expect(mounted).toHaveBeenCalledTimes(1); expect(unmounted).not.toHaveBeenCalled();
  });
  it('no monta ni ofrece consulta sin permiso de IA', () => {
    const mount = vi.fn(); function Child() { mount(); return null; }
    render(el(CaseAgentDisclosure, { canUseAi: false, children: el(Child) }));
    expect(screen.queryByRole('button')).toBeNull(); expect(mount).not.toHaveBeenCalled();
  });
  it('pospone el diagnóstico real del componente y no lo repite al cerrar y abrir', async () => {
    render(el(CaseAgentDisclosure, { canUseAi: true, children: el(AgenteChat, { caseId: 'case-1', caseTitle: 'Operación', industry: 'inmobiliaria', puedeUsarIA: true }) }));
    expect(diagnosticoLegajo).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: /Consultar al agente/ });
    fireEvent.click(toggle); await waitFor(() => expect(diagnosticoLegajo).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador real' } });
    fireEvent.click(toggle); fireEvent.click(toggle);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Borrador real');
    expect(diagnosticoLegajo).toHaveBeenCalledTimes(1);
  });
});

describe('Ficha de cliente aprobada', () => {
  it('los indicadores mantienen texto y no crean botones ni focos', () => {
    const { container } = render(el('div', null, el(MatchStatus, { meets: true }), el(MatchStatus, { meets: false })));
    expect(screen.getByText('Cumple')).toBeDefined(); expect(screen.getByText('No cumple')).toBeDefined();
    expect(container.querySelectorAll('button,[role="button"],[tabindex]').length).toBe(0);
  });
  it('conserva conteo dinámico y no trata como incumplimiento un criterio no aplicable', () => {
    const result = evaluarMatch(record, property);
    render(el(ClientDetailReadView, { record, matches: [{ item: property, match: result }], aiAction: null, contactMessage: null }));
    expect(screen.getByText('3 de 3 criterios aplicables')).toBeDefined();
    expect(screen.getAllByText('Cumple')).toHaveLength(3);
    expect(screen.queryByText('No cumple')).toBeNull();
    expect(screen.getByLabelText('Zona: no aplica')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ver propiedad' }).getAttribute('href')).toBe('/propiedades/p1');
  });
  it('muestra cero como valor y los campos geográficos como contexto sin agregarlos al cálculo', () => {
    render(el(ClientDetailReadView, { record, matches: [], aiAction: null, contactMessage: null }));
    expect(screen.getByText('0')).toBeDefined(); expect(screen.getByText(/Buenos Aires/)).toBeDefined();
    expect(screen.getByText(/Plaza Moreno/)).toBeDefined(); expect(screen.getByRole('heading', { name: 'No hay propiedades disponibles' })).toBeDefined();
  });
  it('separa lectura y edición, conserva el borrador y devuelve el foco', async () => {
    render(el(ClientDetailMode, { name: record.name, canManage: true, identity: el('h1', null, record.name), editForm: el('form', null, el('input', { 'aria-label': 'Nombre', defaultValue: record.name })), children: el('p', null, 'Consulta') }));
    const edit = screen.getByRole('button', { name: 'Editar cliente' }); fireEvent.click(edit);
    expect(screen.queryByText('Consulta')?.closest('[hidden]')).not.toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador' } }); fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(document.activeElement).toBe(edit)); fireEvent.click(edit);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Borrador');
  });
  it('no entrega formulario ni edición a un lector', () => {
    render(el(ClientDetailMode, { name: record.name, canManage: false, identity: el('h1', null, record.name), editForm: el('form', null, el('input')), children: el('p', null, 'Consulta') }));
    expect(screen.queryByRole('button', { name: 'Editar cliente' })).toBeNull(); expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('Mensajería compacta opt-in', () => {
  it('prepara explícitamente, permite editar y conserva el texto al cerrar y abrir', () => {
    render(el(WhatsAppIntentBuilder, { compact: true, context: 'client', resourceId: 'c1', defaultMessage: 'Hola Lucía' }));
    expect(screen.queryByRole('textbox')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Preparar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola, coordinamos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mensaje' })); fireEvent.click(screen.getByRole('button', { name: 'Preparar mensaje' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Hola, coordinamos');
  });
  it('el modo por defecto conserva Generar mensaje y no muestra Cerrar mensaje', () => {
    render(el(WhatsAppIntentBuilder, { context: 'operation', resourceId: 'o1', defaultMessage: 'Hola' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generar mensaje' }));
    expect(screen.queryByRole('button', { name: 'Cerrar mensaje' })).toBeNull(); expect(screen.getByRole('button', { name: 'Abrir WhatsApp' })).toBeDefined();
  });
});
