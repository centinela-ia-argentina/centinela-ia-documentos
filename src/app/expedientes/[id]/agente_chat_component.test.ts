/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('./agenteActions', () => ({
  preguntarAgente: vi.fn(),
  diagnosticoLegajo: vi.fn().mockResolvedValue({ ok: true, alertas: [] }),
  ejecutarAccionAgente: vi.fn(),
}));

import { preguntarAgente } from './agenteActions';
import { AgenteChat } from './AgenteChat';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.IntersectionObserver = MockIntersectionObserver as any;

describe('T-AUD-P2-017: Componente AgenteChat y observabilidad de memoria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Al fallar persistencia: muestra advertencia no bloqueante, oculta "Memoria guardada", muestra estado de error y la respuesta generada sigue visible', async () => {
    vi.mocked(preguntarAgente).mockResolvedValue({
      ok: true,
      respuesta: 'Respuesta generada con éxito por la IA',
      acciones: [],
      memoryPersisted: false,
    });

    render(
      React.createElement(AgenteChat, {
        caseId: 'case-1',
        caseTitle: 'Expediente Test',
        industry: 'legal',
        puedeUsarIA: true,
      })
    );

    // Inicialmente no afirma "Memoria guardada"
    expect(screen.queryByText('💾 Memoria guardada')).toBeNull();

    // Enviar pregunta
    const textarea = screen.getByPlaceholderText(/Escribí tu consulta sobre el expediente/i);
    fireEvent.change(textarea, { target: { value: '¿Cuál es el estado?' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      // 1. La respuesta generada sigue visible en el chat
      expect(screen.getByText('Respuesta generada con éxito por la IA')).toBeDefined();
    });

    // 2. Fallo muestra advertencia
    expect(screen.getByText(/no se pudo guardar la conversación en la memoria/i)).toBeDefined();

    // 3. Fallo NO muestra "Memoria guardada"
    expect(screen.queryByText('💾 Memoria guardada')).toBeNull();

    // 4. Muestra badge de advertencia
    expect(screen.getByText('⚠️ No se pudo guardar la conversación')).toBeDefined();
  });

  it('2. Al persistir exitosamente: muestra "Memoria guardada" y no muestra advertencia', async () => {
    vi.mocked(preguntarAgente).mockResolvedValue({
      ok: true,
      respuesta: 'Respuesta persistida con éxito',
      acciones: [],
      memoryPersisted: true,
    });

    render(
      React.createElement(AgenteChat, {
        caseId: 'case-1',
        caseTitle: 'Expediente Test',
        industry: 'legal',
        puedeUsarIA: true,
      })
    );

    const textarea = screen.getByPlaceholderText(/Escribí tu consulta sobre el expediente/i);
    fireEvent.change(textarea, { target: { value: '¿Tiene plazos?' } });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Respuesta persistida con éxito')).toBeDefined();
    });

    // Éxito muestra estado "Memoria guardada"
    expect(screen.getByText('💾 Memoria guardada')).toBeDefined();
    // No muestra advertencia
    expect(screen.queryByText(/no se pudo guardar la conversación en la memoria/i)).toBeNull();
  });
});
