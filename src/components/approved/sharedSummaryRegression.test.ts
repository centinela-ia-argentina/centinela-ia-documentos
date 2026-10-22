/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaseSummaryLayout } from './CaseSummaryLayout';
import { CaseAgentDisclosure } from './CaseAgentDisclosure';
import { AgenteChat } from '@/app/expedientes/[id]/AgenteChat';
import { getIndustryTerms } from '@/lib/industries/uiLabels';

vi.mock('@/app/expedientes/[id]/agenteActions', () => ({
  diagnosticoLegajo: vi.fn().mockResolvedValue({ ok: true, alertas: [] }),
  preguntarAgente: vi.fn(), ejecutarAccionAgente: vi.fn(), borrarConversacionAgente: vi.fn(),
}));
import { diagnosticoLegajo, preguntarAgente, ejecutarAccionAgente } from '@/app/expedientes/[id]/agenteActions';
const el = React.createElement;
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

for (const industry of ['inmobiliaria', 'legal', 'escribania'] as const) {
  describe(`Resumen compartido: ${industry}`, () => {
    it('conserva el contexto del rubro, abre a demanda y no envía consultas automáticamente', async () => {
      render(el(CaseAgentDisclosure, { canUseAi: true, children: el(AgenteChat, {
        caseId: `fixture-${industry}`, caseTitle: 'Registro ficticio', industry, puedeUsarIA: true,
      }) }));
      expect(diagnosticoLegajo).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      const toggle = screen.getByRole('button', { name: /Consultar al agente/ });
      fireEvent.click(toggle);
      await waitFor(() => expect(diagnosticoLegajo).toHaveBeenCalledTimes(1));
      const terms = getIndustryTerms(industry);
      expect(screen.getByText(new RegExp(`Trabaja con los documentos y antecedentes de ${terms.eseExpediente}`))).toBeDefined();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: `Borrador ${industry}` } });
      fireEvent.click(toggle);
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(toggle);
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Borrador ${industry}`);
      expect(diagnosticoLegajo).toHaveBeenCalledTimes(1);
      expect(preguntarAgente).not.toHaveBeenCalled();
      expect(ejecutarAccionAgente).not.toHaveBeenCalled();
    });
    it('no monta el agente ni diagnostica si el lector carece de permiso', () => {
      render(el(CaseAgentDisclosure, { canUseAi: false, children: el(AgenteChat, {
        caseId: `fixture-${industry}`, caseTitle: 'Registro ficticio', industry, puedeUsarIA: false,
      }) }));
      expect(screen.queryByRole('button')).toBeNull();
      expect(diagnosticoLegajo).not.toHaveBeenCalled();
    });
    it('retira el agente y su borrador de la interfaz al retirar el permiso', async () => {
      const child = el(AgenteChat, { caseId: `fixture-${industry}`, caseTitle: 'Registro ficticio', industry, puedeUsarIA: true });
      const { rerender } = render(el(CaseAgentDisclosure, { canUseAi: true, children: child }));
      fireEvent.click(screen.getByRole('button', { name: /Consultar al agente/ }));
      await waitFor(() => expect(diagnosticoLegajo).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador privado' } });
      rerender(el(CaseAgentDisclosure, { canUseAi: false, children: child }));
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByText('Borrador privado')).toBeNull();
      expect(preguntarAgente).not.toHaveBeenCalled();
    });
  });
}

describe('Jerarquía del resumen compartido', () => {
  it('mantiene datos, resumen, fechas, agente y herramientas en orden accesible', () => {
    const { container } = render(el(CaseSummaryLayout, {
      facts: el('p', null, 'Datos ficticios'), summary: el('p', null, 'Lectura guardada'),
      dates: el('p', null, 'Fechas ficticias'), agent: el('section', { 'aria-label': 'Consulta al agente' }),
      children: el('a', { href: '#herramienta' }, 'Herramienta conservada'),
    }));
    expect(Array.from(container.querySelectorAll('[aria-label]')).map(n => n.getAttribute('aria-label'))).toEqual([
      'Datos del registro', 'Resumen guardado', 'Fechas del registro', 'Consulta al agente', 'Herramientas del registro',
    ]);
    expect(screen.getByRole('link', { name: 'Herramienta conservada' }).getAttribute('href')).toBe('#herramienta');
  });
  it('no monta un agente sin permiso aunque el resumen permanezca disponible', () => {
    const mounted = vi.fn();
    function Child() { mounted(); return null; }
    render(el(CaseSummaryLayout, {
      facts: 'Datos', summary: 'Resumen disponible', dates: 'Sin fechas',
      agent: el(CaseAgentDisclosure, { canUseAi: false, children: el(Child) }), children: 'Herramientas',
    }));
    expect(screen.getByText('Resumen disponible')).toBeDefined();
    expect(mounted).not.toHaveBeenCalled();
  });
});
