/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PostFirmaPanel } from './PostFirmaPanel';
import { guardarPlazoDetectado } from '@/app/agenda/actions';

vi.mock('@/app/agenda/actions', () => ({ guardarPlazoDetectado: vi.fn() }));
const mockGuardar = guardarPlazoDetectado as unknown as ReturnType<typeof vi.fn>;
const el = React.createElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockGuardar.mockResolvedValue({ ok: true, created: true });
});
afterEach(cleanup);

describe('PostFirmaPanel', () => {
  it('no agenda nada al montar: sin fechas no se crea ningún evento', () => {
    render(el(PostFirmaPanel, { caseId: 'c1', caseTitle: 'Escritura Díaz', fechaBase: null }));
    expect(screen.getByTestId('postfirma-panel')).toBeDefined();
    expect(mockGuardar).not.toHaveBeenCalled();
    expect((screen.getByTestId('postfirma-agendar-sellado') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('postfirma-agendar-inscripcion') as HTMLButtonElement).disabled).toBe(true);
  });

  it('agendar sellado llama a la agenda con categoría plazo, caso y fecha', async () => {
    render(el(PostFirmaPanel, { caseId: 'c1', caseTitle: 'Escritura Díaz', fechaBase: '2026-11-26' }));
    fireEvent.change(screen.getByLabelText('Fecha de Sellado'), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('postfirma-agendar-sellado'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));
    const call = mockGuardar.mock.calls[0][0];
    expect(call.titulo).toBe('Sellado — Escritura Díaz');
    expect(call.fecha).toBe('2026-12-10');
    expect(call.caseId).toBe('c1');
    expect(screen.getByText('Cargado en la Agenda.')).toBeDefined();
  });

  it('duplicado muestra "Ya estaba en la Agenda" sin error', async () => {
    mockGuardar.mockResolvedValue({ ok: true, existing: true });
    render(el(PostFirmaPanel, { caseId: 'c1', caseTitle: '', fechaBase: null }));
    fireEvent.change(screen.getByLabelText('Fecha de Inscripción en el Registro'), { target: { value: '2026-12-15' } });
    fireEvent.click(screen.getByTestId('postfirma-agendar-inscripcion'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(screen.getByText('Ya estaba en la Agenda.')).toBeDefined();
  });

  it('error de agenda muestra mensaje, sin tirar la promesa', async () => {
    mockGuardar.mockRejectedValue(new Error('red'));
    render(el(PostFirmaPanel, { caseId: 'c1', caseTitle: '', fechaBase: null }));
    fireEvent.change(screen.getByLabelText('Fecha de Sellado'), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('postfirma-agendar-sellado'));
    await waitFor(() => expect(screen.getByText('No se pudo agendar. Intentá de nuevo.')).toBeDefined());
  });

  it('deja explícito que no es un plazo legal y permite cerrar sin agendar', () => {
    render(el(PostFirmaPanel, { caseId: 'c1', caseTitle: 'X', fechaBase: '2026-11-26' }));
    expect(screen.getByText(/Sugerencia operativa, no un plazo legal calculado/)).toBeDefined();
    expect(screen.getByText(/Fecha de otorgamiento registrada: 2026-11-26/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Cerrar sin agendar' }).getAttribute('href')).toBe('/expedientes/c1');
  });
});
