/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component HTML Attributes and Props Propagation', () => {
  it('1. Propaga data-testid="checklist-status-badge-0" y atributos HTML al span', () => {
    render(
      React.createElement(
        Badge,
        {
          tone: 'success',
          'data-testid': 'checklist-status-badge-0',
          'aria-label': 'Status Received',
        },
        'Recibido'
      )
    );

    const badge = screen.getByTestId('checklist-status-badge-0');
    expect(badge).toBeDefined();
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('aria-label')).toBe('Status Received');
    expect(badge.textContent).toBe('Recibido');
    expect(badge.className).toContain('border-emerald-400/30');
    expect(badge.className).toContain('rounded-full');
  });

  it('2. Propaga data-testid="checklist-badge-manual-0" y conserva estilos visuales', () => {
    render(
      React.createElement(
        Badge,
        {
          tone: 'accent',
          'data-testid': 'checklist-badge-manual-0',
          className: 'custom-test-class',
        },
        'Manual'
      )
    );

    const badge = screen.getByTestId('checklist-badge-manual-0');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('border-accent/30');
    expect(badge.className).toContain('custom-test-class');
  });

  it('3. Propaga data-testid="checklist-badge-auto-0" con tono neutral por defecto', () => {
    render(
      React.createElement(
        Badge,
        {
          'data-testid': 'checklist-badge-auto-0',
        },
        'Auto'
      )
    );

    const badge = screen.getByTestId('checklist-badge-auto-0');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('border-white/10');
  });
});
