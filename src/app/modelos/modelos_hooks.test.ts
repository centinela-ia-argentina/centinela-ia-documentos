/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelosClient } from './ModelosClient';

vi.mock('server-only', () => ({}));
vi.mock('./actions', () => ({
  extraerDatosParaModelo: vi.fn(),
  redactarEscritoIA: vi.fn(),
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.IntersectionObserver = MockIntersectionObserver as any;

describe('T-AUD-P3-019: Dependencia completa de useMemo en ModelosClient', () => {
  it('actualiza categorias al cambiar la prop industria en rerender', () => {
    const { rerender } = render(
      React.createElement(ModelosClient, {
        expedientes: [],
        puedeIA: true,
        industria: 'legal',
      })
    );

    // En rubro legal debe figurar "Escrito de presentación (genérico)" y no escrituras notariales
    expect(screen.getByText('Escrito de presentación (genérico)')).toBeDefined();
    expect(screen.queryByText('Escritura de compraventa de inmueble')).toBeNull();

    // Rerender con industria "escribania"
    rerender(
      React.createElement(ModelosClient, {
        expedientes: [],
        puedeIA: true,
        industria: 'escribania',
      })
    );

    // Debe reaccionar a la nueva industria y mostrar instrumentos notariales
    expect(screen.getByText('Escritura de compraventa de inmueble')).toBeDefined();
    expect(screen.queryByText('Escrito de presentación (genérico)')).toBeNull();
  });
});
