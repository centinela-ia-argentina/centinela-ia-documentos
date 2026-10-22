import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), createClient: vi.fn(), from: vi.fn(), redirect: vi.fn(), notFound: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: mocks.profile }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: 'main' }));
vi.mock('@/components/approved/ClientDetailMode', () => ({ ClientDetailMode: 'client-detail-mode' }));
vi.mock('@/components/approved/ClientDetailReadView', () => ({ ClientDetailReadView: 'client-read-view' }));
vi.mock('@/components/ui/FormSubmitButton', () => ({ FormSubmitButton: 'submit-fixture' }));
vi.mock('./ClientMatchAiButton', () => ({ ClientMatchAiButton: 'ai-fixture' }));
vi.mock('@/components/WhatsAppIntentBuilder', () => ({ WhatsAppIntentBuilder: 'message-fixture' }));
vi.mock('../actions', () => ({ updateClientRecord: vi.fn() }));
import Page from './page';

const record = { id: 'client-a', organization_id: 'org-a', name: 'Contacto ficticio', status: 'activo', client_type: 'comprador' };
function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result), then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
}
let clients: ReturnType<typeof query>;
let properties: ReturnType<typeof query>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ user: { id: 'user-a' }, profile: { role: 'admin', organization_id: 'org-a' } });
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`REDIRECT:${url}`); });
  mocks.notFound.mockImplementation(() => { throw new Error('NOT_FOUND'); });
  clients = query(record); properties = query([]);
  mocks.from.mockImplementation((table: string) => { if (table === 'clients') return clients; if (table === 'properties') return properties; throw new Error(`Tabla inesperada: ${table}`); });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
});
const load = () => Page({ params: Promise.resolve({ id: 'client-a' }) });
function findProps(node: React.ReactNode, type: string): Record<string, unknown> | undefined {
  if (Array.isArray(node)) { for (const child of node) { const found = findProps(child, type); if (found) return found; } return; }
  if (!React.isValidElement(node)) return;
  const props = node.props as Record<string, unknown>;
  if (node.type === type) return props;
  return findProps(props.children as React.ReactNode, type);
}

describe('Acceso de la página real de cliente con Supabase simulado', () => {
  it('redirige a login antes de consultar datos cuando falta sesión', async () => {
    mocks.profile.mockResolvedValue({ user: null, profile: null });
    await expect(load()).rejects.toThrow('REDIRECT:/login');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('redirige a onboarding antes de consultar datos si falta perfil', async () => {
    mocks.profile.mockResolvedValue({ user: { id: 'user-a' }, profile: null });
    await expect(load()).rejects.toThrow('REDIRECT:/onboarding');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('impide la ficha al rol client antes de consultar Supabase', async () => {
    mocks.profile.mockResolvedValue({ user: { id: 'user-a' }, profile: { role: 'client', organization_id: 'org-a' } });
    await expect(load()).rejects.toThrow('REDIRECT:/acceso-denegado');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('filtra cliente y propiedades por la organización del perfil', async () => {
    await load();
    expect(clients.eq).toHaveBeenCalledWith('id', 'client-a');
    expect(clients.eq).toHaveBeenCalledWith('organization_id', 'org-a');
    expect(properties.eq).toHaveBeenCalledWith('organization_id', 'org-a');
    expect(properties.eq).toHaveBeenCalledWith('status', 'disponible');
    expect(properties.is).toHaveBeenCalledWith('archived_at', null);
  });
  it('no consulta propiedades cuando no encuentra un cliente autorizado', async () => {
    clients = query(null);
    await expect(load()).rejects.toThrow('NOT_FOUND');
    expect(mocks.from).not.toHaveBeenCalledWith('properties');
  });
  it('no entrega la ficha ni consulta propiedades ante error del cliente', async () => {
    clients = query(null, { message: 'Error simulado' });
    await expect(load()).rejects.toThrow('NOT_FOUND');
    expect(mocks.from).not.toHaveBeenCalledWith('properties');
  });
  it('no incluye formulario ni acción de IA en el árbol entregado al auditor', async () => {
    mocks.profile.mockResolvedValue({ user: { id: 'user-a' }, profile: { role: 'auditor', organization_id: 'org-a' } });
    const tree = await load();
    const mode = findProps(tree, 'client-detail-mode');
    expect(mode?.canManage).toBe(false);
    expect(mode?.editForm).toBeNull();
    expect(findProps(mode?.children as React.ReactNode, 'client-read-view')?.aiAction).toBeNull();
  });
  it('conserva el formulario real y el identificador del registro para el administrador', async () => {
    const tree = await load();
    const mode = findProps(tree, 'client-detail-mode');
    expect(mode?.canManage).toBe(true);
    const form = findProps(mode?.editForm as React.ReactNode, 'form');
    expect(form?.action).toBeTypeOf('function');
    const inputs: Record<string, unknown>[] = [];
    function collect(node: React.ReactNode) {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!React.isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (node.type === 'input') inputs.push(props);
      collect(props.children as React.ReactNode);
    }
    collect(mode?.editForm as React.ReactNode);
    expect(inputs).toContainEqual(expect.objectContaining({ name: 'client_id', value: 'client-a', type: 'hidden' }));
    expect(inputs).toContainEqual(expect.objectContaining({ name: 'name', defaultValue: 'Contacto ficticio', required: true }));
  });
});
