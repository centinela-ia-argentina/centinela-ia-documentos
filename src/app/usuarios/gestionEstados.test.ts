import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/permissions/platformOwner', () => ({
  isPlatformOwner: vi.fn(async () => false),
}));
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: unknown }) => h('div', null, children as any),
}));
vi.mock('@/components/ui/MotionCard', () => ({
  MotionCard: ({ children, className }: any) => h('div', { className }, children as any),
}));

import UsuariosPage from './page';
import InvitationsPage from './invitaciones/page';
import ConfiguracionPage from '../configuracion/page';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';

const profile = {
  id: 'u1',
  organization_id: 'org-1',
  role: 'admin',
  status: 'active',
  email: 'admin@x',
  full_name: 'Admin',
};

function makeSupabase(handlers: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const result = handlers[table] ?? { data: [], error: null };
      const api: any = {
        select: () => api,
        eq: () => api,
        neq: () => api,
        order: () => api,
        limit: () => api,
        single: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
        in: () => api,
        is: () => api,
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      return api;
    },
  } as any;
}

beforeEach(() => {
  (getUserProfile as any).mockResolvedValue({ user: { id: 'u1', last_sign_in_at: null }, profile });
});

describe('Usuarios — fallo de consulta no se presenta como vacío', () => {
  it('profiles con error → indicadores en guion y aviso de no disponible', async () => {
    (createClient as any).mockResolvedValue(makeSupabase({
      profiles: { data: null, error: { message: 'x' } },
      audit_logs: { data: [], error: null },
      organizations: { data: { industry_type: 'legal' }, error: null },
    }));

    const html = renderToString(await UsuariosPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('No se pudieron consultar los perfiles');
    expect(html).toContain('—');
    expect(html).not.toContain('Todavía no hay usuarios registrados');
  });

  it('rol o estado desconocido no se rellenan con valores por defecto', async () => {
    (createClient as any).mockResolvedValue(makeSupabase({
      profiles: {
        data: [{ id: 'u2', full_name: 'Otro', email: 'o@x', role: null, status: 'raro' }],
        error: null,
      },
      audit_logs: { data: [], error: null },
      organizations: { data: { industry_type: 'legal' }, error: null },
    }));

    const html = renderToString(await UsuariosPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('Sin definir');
    expect(html).not.toContain('value="employee" selected');
    expect(html).toContain('los últimos 80 eventos de la organización');
  });

  it('estado inactivo se presenta neutral, no como error', async () => {
    (createClient as any).mockResolvedValue(makeSupabase({
      profiles: {
        data: [{ id: 'u2', full_name: 'Otro', email: 'o@x', role: 'employee', status: 'inactive' }],
        error: null,
      },
      audit_logs: { data: [], error: null },
      organizations: { data: { industry_type: 'legal' }, error: null },
    }));

    const html = renderToString(await UsuariosPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Inactivo');
    expect(html).not.toContain('bg-rose-50 text-rose-700">Inactivo');
  });
});

describe('Invitaciones — estados, vencimientos y fallos', () => {
  const baseHandlers = (extra: Record<string, unknown> = {}) => ({
    user_invitations: { data: [], error: null },
    profiles: { data: [{ id: 'u1', full_name: 'Admin', email: 'admin@x', role: 'admin' }], error: null },
    ...extra,
  });

  it('invitaciones con error → bandeja no disponible, indicadores en guion', async () => {
    (createClient as any).mockResolvedValue(makeSupabase(baseHandlers({
      user_invitations: { data: null, error: { message: 'x' } },
    })));

    const html = renderToString(await InvitationsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('No se pudieron consultar las invitaciones');
    expect(html).not.toContain('Todavía no hay invitaciones registradas');
    expect(html).toContain('—');
  });

  it('vencimiento ausente → "No disponible" y sin acción de cancelación', async () => {
    (createClient as any).mockResolvedValue(makeSupabase(baseHandlers({
      user_invitations: {
        data: [{ id: 'i1', organization_id: 'org-1', email: 'n@x', role: 'employee', status: 'pending', expires_at: null }],
        error: null,
      },
    })));

    const html = renderToString(await InvitationsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('No disponible');
    expect(html).not.toContain('Cancelar');
  });

  it('pendiente con vencimiento válido y admin → cancelación disponible', async () => {
    (createClient as any).mockResolvedValue(makeSupabase(baseHandlers({
      user_invitations: {
        data: [{ id: 'i1', organization_id: 'org-1', email: 'n@x', role: 'employee', status: 'pending', expires_at: '2099-01-01T00:00:00.000Z' }],
        error: null,
      },
    })));

    const html = renderToString(await InvitationsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Cancelar');
  });
});

describe('Ajustes — organización no disponible y rubro sin selección automática', () => {
  it('fallo de consulta de organización → aviso y sin formularios con valores por defecto', async () => {
    (createClient as any).mockResolvedValue(makeSupabase({
      organizations: { data: null, error: { message: 'x' } },
    }));

    const html = renderToString(await ConfiguracionPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('No se pudieron consultar los datos de la organización');
    expect(html).not.toContain('Guardar nombre');
    expect(html).not.toContain('Guardar rubro');
  });

  it('rubro sin definir exige elección explícita (no preselecciona legal)', async () => {
    (createClient as any).mockResolvedValue(makeSupabase({
      organizations: { data: { name: 'Estudio', industry_type: null, logo_url: null }, error: null },
    }));

    const html = renderToString(await ConfiguracionPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('— Sin selección (definir explícitamente) —');
    expect(html).not.toContain('selected>');
  });
});
