/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ComparadorInstrumentos } from './ComparadorInstrumentos';
import type { ComparacionInstrumentos } from '@/lib/ai/comparador';

vi.mock('../actions', () => ({ compararDocumentosExpediente: vi.fn() }));
const el = React.createElement;

const docs = [
  { id: 'd1', file_name: 'minuta.pdf' },
  { id: 'd2', file_name: 'protocolizada.pdf' },
];

const resultado: ComparacionInstrumentos = {
  resumen: 'Los instrumentos coinciden en partes e inmueble.',
  diferencias: [{ seccion: 'Precio', detalle: 'A dice $100.000; B dice $150.000.' }],
  coincidencias: ['Partes idénticas'],
  advertencias: ['Verificar fecha de otorgamiento.'],
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function mount(extra: Record<string, unknown> = {}) {
  return render(el(ComparadorInstrumentos, {
    caseId: 'c1', documents: docs, comparacion: null, generadoEl: null, puedeUsarIA: true, ...extra,
  }));
}

describe('ComparadorInstrumentos', () => {
  it('sin IA no ofrece el form y lo dice', () => {
    mount({ puedeUsarIA: false });
    expect(screen.queryByTestId('comparador-doc-a')).toBeNull();
    expect(screen.getByText('Tu rol no permite usar la IA.')).toBeDefined();
  });

  it('con menos de dos documentos pide cargarlos, no ofrece selects', () => {
    mount({ documents: [docs[0]] });
    expect(screen.queryByTestId('comparador-doc-a')).toBeNull();
    expect(screen.getByText(/Cargá al menos dos documentos/)).toBeDefined();
  });

  it('form con selects requeridos y case_id oculto', () => {
    mount();
    expect((screen.getByTestId('comparador-doc-a') as HTMLSelectElement).required).toBe(true);
    expect((screen.getByTestId('comparador-doc-b') as HTMLSelectElement).required).toBe(true);
    const form = screen.getByTestId('comparador-doc-a').closest('form')!;
    const hidden = form.querySelector('input[name="case_id"]');
    expect(hidden?.getAttribute('value')).toBe('c1');
    expect(screen.getByText('Esto puede tardar hasta un minuto.')).toBeDefined();
  });

  it('feedback de error se mapea a mensaje humano', () => {
    mount({ feedback: 'sin_texto' });
    expect(screen.getByTestId('comparador-feedback').textContent).toContain('PDF escaneado o formato no soportado');
  });

  it('resultado completo: diferencias, coincidencias, advertencias y aviso de lectura guardada', () => {
    mount({ comparacion: resultado, generadoEl: '2026-11-26T03:00:00Z' });
    expect(screen.getByTestId('comparador-resultado')).toBeDefined();
    expect(screen.getByTestId('comparador-diferencias').textContent).toContain('A dice $100.000; B dice $150.000.');
    expect(screen.getByTestId('comparador-coincidencias').textContent).toContain('Partes idénticas');
    expect(screen.getByTestId('comparador-advertencias').textContent).toContain('Verificar fecha de otorgamiento.');
    expect(screen.getByText(/Lectura guardada · Revisar antes de usar/)).toBeDefined();
  });

  it('resultado sin diferencias no renderiza la lista roja', () => {
    mount({ comparacion: { ...resultado, diferencias: [] } });
    expect(screen.queryByTestId('comparador-diferencias')).toBeNull();
  });

  it('elegir dos veces el mismo documento no pasa validación required', () => {
    mount();
    const a = screen.getByTestId('comparador-doc-a') as HTMLSelectElement;
    fireEvent.change(a, { target: { value: 'd1' } });
    expect(a.value).toBe('d1');
  });
});
