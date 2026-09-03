/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { canUseAi } from '@/lib/permissions/roles';
import { extraerDatosParaModelo, redactarEscritoIA } from './actions';
import { ModelosClient } from './ModelosClient';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn().mockResolvedValue('legal'),
}));
vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('./actions', () => ({
  extraerDatosParaModelo: vi.fn().mockResolvedValue({ actor: 'Actor Extraido' }),
  redactarEscritoIA: vi.fn().mockResolvedValue({ ok: true, texto: 'Borrador IA' }),
}));

// Framer Motion polyfills for jsdom
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.IntersectionObserver = MockIntersectionObserver as any;

describe('T-AUD-P2-015: Controles de IA para Rol Auditor en Modelos', () => {
  const globalFetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = globalFetchMock;
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('1. canUseAi bloquea auditor y client, pero autoriza admin y employee', () => {
    expect(canUseAi('auditor')).toBe(false);
    expect(canUseAi('client')).toBe(false);
    expect(canUseAi('admin')).toBe(true);
    expect(canUseAi('employee')).toBe(true);
  });

  it('2. Componente ModelosClient para Auditor (puedeIA=false): oculta Redactar con IA, conserva controles manuales y no llama a extraerDatosParaModelo', async () => {
    const expedientesMock = [
      {
        id: 'case-1',
        title: 'Perez c/ Gomez',
        client_name: 'Perez Juan',
        case_type: 'Laboral',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          caratula: 'Perez c/ Gomez',
          actor: 'Perez Juan',
          demandado: 'Gomez SRL',
        },
      },
    ];

    render(
      React.createElement(ModelosClient, {
        expedientes: expedientesMock,
        industria: 'legal',
        puedeIA: false,
      })
    );

    // 1. Catálogo presente
    expect(screen.getByText('Escrito de presentación (genérico)')).toBeDefined();

    // 2. Abrir modelo
    fireEvent.click(screen.getByText('Escrito de presentación (genérico)'));

    // 3. Controles manuales presentes: Vista previa, Copiar, Descargar TXT, DOCX
    expect(screen.getByText('Vista previa')).toBeDefined();
    expect(screen.getByText('Copiar')).toBeDefined();
    expect(screen.getByText(/Descargar \.txt/i)).toBeDefined();
    expect(screen.getByText(/Word \(\.docx\)/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Completar caratula/i)).toBeDefined();

    // 4. "Redactar con IA" ausente para auditor
    expect(screen.queryByText('Redactar con IA')).toBeNull();
    expect(screen.queryByText('Redactar con IA (opcional)')).toBeNull();

    // 5. Aplicar expediente como auditor: carga datos manuales pero NO llama a extraerDatosParaModelo ni muestra spinner
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'case-1' } });

    await waitFor(() => {
      const inputCaratula = screen.getByPlaceholderText(/Completar caratula/i) as HTMLInputElement;
      expect(inputCaratula.value).toBe('Perez c/ Gomez');
    });

    // extraerDatosParaModelo NO debe ser llamado
    expect(extraerDatosParaModelo).not.toHaveBeenCalled();
    // No debe haber spinner de IA
    expect(screen.queryByText(/Analizando los documentos/)).toBeNull();
  });

  it('3. Componente ModelosClient para Admin/Employee (puedeIA=true): muestra Redactar con IA y ejecuta extraerDatosParaModelo', async () => {
    const expedientesMock = [
      {
        id: 'case-1',
        title: 'Perez c/ Gomez',
        client_name: 'Perez Juan',
        case_type: 'Laboral',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          caratula: 'Perez c/ Gomez',
          actor: 'Perez Juan',
          demandado: 'Gomez SRL',
        },
      },
    ];

    render(
      React.createElement(ModelosClient, {
        expedientes: expedientesMock,
        industria: 'legal',
        puedeIA: true,
      })
    );

    // Abrir modelo
    fireEvent.click(screen.getByText('Escrito de presentación (genérico)'));

    // Redactar con IA DEBE estar visible para admin/employee
    expect(screen.getByText('Redactar con IA (opcional)')).toBeDefined();
    expect(screen.getByText('Redactar con IA')).toBeDefined();

    // Aplicar expediente: DEBE llamar a extraerDatosParaModelo
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'case-1' } });

    await waitFor(() => {
      expect(extraerDatosParaModelo).toHaveBeenCalled();
    });
  });
});
