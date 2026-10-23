/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AccountMenu } from './AccountMenu';
import { ShellFrame } from './AppShell';
import { Tabs } from '../ui/Tabs';
import type { IndustryType } from '@/lib/industries/documentTypes';

const state = vi.hoisted(() => ({
  role: 'admin',
  industry: 'inmobiliaria' as IndustryType,
  pathname: '/clientes/ejemplo',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/shell/getShellContext', () => ({
  getShellContext: async () => ({
    profile: { role: state.role, full_name: 'Persona de prueba' },
    role: state.role,
    industry: state.industry,
    organizationName: 'Organización de prueba',
  }),
}));
vi.mock('@/app/login/actions', () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  state.role = 'admin';
  state.industry = 'inmobiliaria';
  window.history.replaceState(null, '', '/');
});
const h = React.createElement;

describe('Marco V3: contracts retained', () => {
  it.each(['inmobiliaria', 'legal', 'escribania'] as IndustryType[])(
    'preserves industry routes and role filtering for %s', async (industry) => {
      state.industry = industry;
      render(await Sidebar());
      const desktop = within(screen.getByRole('complementary', { name: 'Barra lateral' }));
      const links = desktop.getAllByRole('link');
      expect(links.some((link) => link.getAttribute('href') === '/usuarios')).toBe(true);
      expect(links.some((link) => link.getAttribute('href') === (industry === 'inmobiliaria' ? '/operaciones' : '/expedientes'))).toBe(true);
      expect(links.some((link) => link.getAttribute('href') === '/clientes')).toBe(industry === 'inmobiliaria');
      expect(links.some((link) => link.getAttribute('href') === '/protocolo')).toBe(industry === 'escribania');
    },
  );
  it.each(['admin', 'employee', 'auditor'])('preserves navigation permissions for %s', async (role) => {
    state.role = role;
    render(await Sidebar());
    const desktop = within(screen.getByRole('complementary'));
    expect(!!desktop.queryByRole('link', { name: 'Usuarios' })).toBe(role === 'admin');
    expect(!!desktop.queryByRole('link', { name: 'Agente IA general' })).toBe(role !== 'auditor');
    expect(desktop.getByRole('link', { name: 'Clientes' }).getAttribute('aria-current')).toBe('page');
    expect(desktop.getByRole('link', { name: 'Reportes' })).toBeTruthy();
  });
  it.each(['inmobiliaria', 'legal', 'escribania'] as IndustryType[])('retains topbar destinations for %s', async (industry) => {
    state.industry = industry;
    render(await Topbar());
    expect(screen.getByRole('link', { name: /Buscar .*documento o cliente/ }).getAttribute('href')).toBe('/buscar');
    const action = screen.getByRole('link', { name: industry === 'inmobiliaria' ? 'Nueva operación' : 'Subir documento' });
    expect(action.getAttribute('href')).toBe(industry === 'inmobiliaria' ? '/operaciones/nueva' : '/documentos/subir');
  });
  it('keeps the native sign-out form and account settings in the sidebar', async () => {
    render(await Sidebar());
    const sidebar = screen.getByRole('complementary');
    const account = sidebar.querySelector('summary[aria-label="Abrir menú de cuenta"]')!.closest('details')!;
    account.open = true;
    expect(within(sidebar).getByRole('link', { name: 'Ajustes de cuenta' }).getAttribute('href')).toBe('/configuracion');
    const button = within(sidebar).getByRole('button', { name: 'Cerrar sesión' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.closest('form')).toBeTruthy();
  });
  it('closes the account menu with Escape and returns focus', () => {
    render(h(AccountMenu, { summary: 'Cuenta', children: h('a', { href: '/configuracion' }, 'Ajustes') }));
    const summary = screen.getByText('Cuenta');
    const details = summary.closest('details')!;
    details.open = true;
    screen.getByText('Ajustes').focus();
    fireEvent.keyDown(details, { key: 'Escape' });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
  it('closes account menus on outside pointer without stealing focus', () => {
    render(h(AccountMenu, { summary: 'Cuenta', children: h('a', { href: '/configuracion' }, 'Ajustes') }));
    const details = screen.getByText('Cuenta').closest('details')!;
    details.open = true;
    fireEvent.pointerDown(document.body);
    expect(details.open).toBe(false);
  });
  it('supplies a skip link, main destination and explicit V3 boundary', () => {
    const view = render(h(ShellFrame, { sidebar: 'Navegación', topbar: 'Contexto', children: 'Contenido' }));
    expect(view.container.querySelector('[data-visual-system="v3"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe('#contenido-principal');
    expect(screen.getByRole('main').id).toBe('contenido-principal');
    expect(screen.getByRole('main').tabIndex).toBe(-1);
  });
});

describe('Approved tab controls retain navigation and mounted content', () => {
  const tabs = [
    { id: 'resumen', label: 'Resumen', content: h('p', null, 'Lectura guardada') },
    { id: 'documentos', label: 'Documentos', content: h('input', { 'aria-label': 'Borrador' }) },
  ];
  it('respects a valid URL tab and preserves unrelated search parameters', () => {
    window.history.replaceState(null, '', '/?tab=documentos&filtro=vigentes');
    render(h(Tabs, { tabs }));
    expect(screen.getByRole('tab', { name: 'Documentos' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    expect(new URLSearchParams(location.search).get('tab')).toBe('resumen');
    expect(new URLSearchParams(location.search).get('filtro')).toBe('vigentes');
  });
  it('supports arrows, Home/End, focus and linked panels', () => {
    render(h(Tabs, { tabs }));
    const first = screen.getByRole('tab', { name: 'Resumen' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const last = screen.getByRole('tab', { name: 'Documentos' });
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
  });
  it('does not remount panels or discard form content', () => {
    render(h(Tabs, { tabs }));
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    const input = screen.getByRole('textbox', { name: 'Borrador' });
    fireEvent.change(input, { target: { value: 'Conservar' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    expect(screen.queryByRole('textbox', { name: 'Borrador' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByRole('textbox', { name: 'Borrador' })).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Conservar');
  });
});

describe('Style migration boundaries', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  it('quarantines every historical dark-shell rule from V3', () => {
    const legacy = css.slice(0, css.indexOf('/* Approved internal V3 only.'));
    const selectors = legacy.match(/\.internal-shell[^,{]*/g) ?? [];
    expect(selectors.length).toBeGreaterThan(50);
    expect(selectors.every((selector) => selector.startsWith('.internal-shell:not([data-visual-system="v3"])'))).toBe(true);
  });
  it('retains native options outside V3 and forced-colour fallback inside', () => {
    expect(css).toContain('select option {\n  background-color: #0b1918;');
    expect(css).toContain('select:not([multiple]):not([size])');
    expect(css).toContain('padding-right: 44px');
    expect(css).toContain('background-position: right 14px center');
    expect(css).toContain('@media (forced-colors: active)');
  });
});