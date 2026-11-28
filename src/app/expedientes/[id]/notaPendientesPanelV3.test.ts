/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NotaPendientesPanel } from './NotaPendientesPanel';

const el = React.createElement;

beforeEach(() => {
  vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NotaPendientesPanel', () => {
  it('monta el borrador editable con el texto del servidor', () => {
    render(el(NotaPendientesPanel, { texto: 'Borrador inicial' }));
    const ta = screen.getByTestId('nota-pendientes-texto') as HTMLTextAreaElement;
    expect(ta.value).toBe('Borrador inicial');
    expect(screen.getByText(/La plataforma no envía nada/)).toBeDefined();
  });

  it('el humano puede editar el texto antes de copiarlo', () => {
    render(el(NotaPendientesPanel, { texto: 'Borrador' }));
    const ta = screen.getByTestId('nota-pendientes-texto') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Texto ajustado por el escribano' } });
    expect(ta.value).toBe('Texto ajustado por el escribano');
  });

  it('copiar manda el texto editado al portapapeles y confirma', async () => {
    render(el(NotaPendientesPanel, { texto: 'Nota' }));
    const ta = screen.getByTestId('nota-pendientes-texto') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Nota editada' } });
    fireEvent.click(screen.getByTestId('nota-pendientes-copiar'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Nota editada'));
    await waitFor(() => expect(screen.getByText('Copiado')).toBeDefined());
  });
});
