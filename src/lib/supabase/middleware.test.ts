import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as { role?: string | null; status?: string | null } | null,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authState.user },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: authState.profile,
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

import { updateSession } from './middleware';

function request(pathname: string) {
  return new NextRequest(`https://centinela.test${pathname}`);
}

function redirectPath(response: Response) {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe('middleware de rutas canónicas inmobiliarias', () => {
  beforeEach(() => {
    authState.user = null;
    authState.profile = null;
  });

  it.each(['/operaciones', '/propiedades', '/clientes', '/alquileres'])(
    'redirige usuarios anónimos desde %s',
    async (pathname) => {
      const response = await updateSession(request(pathname));

      expect(response.status).toBe(307);
      expect(redirectPath(response)).toBe('/login');
    }
  );

  it('bloquea un perfil inactivo en /operaciones', async () => {
    authState.user = { id: 'user-inactive' };
    authState.profile = { role: 'employee', status: 'inactive' };

    const response = await updateSession(request('/operaciones'));

    expect(response.status).toBe(307);
    expect(redirectPath(response)).toBe('/acceso-denegado?motivo=estado');
  });

  it('bloquea un rol no operador en /operaciones/nueva', async () => {
    authState.user = { id: 'user-auditor' };
    authState.profile = { role: 'auditor', status: 'active' };

    const response = await updateSession(request('/operaciones/nueva'));

    expect(response.status).toBe(307);
    expect(redirectPath(response)).toBe('/acceso-denegado?motivo=rol');
  });

  it('permite a un empleado activo abrir /operaciones/nueva', async () => {
    authState.user = { id: 'user-employee' };
    authState.profile = { role: 'employee', status: 'active' };

    const response = await updateSession(request('/operaciones/nueva'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});