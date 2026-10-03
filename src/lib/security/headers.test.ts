import { describe, expect, it } from 'vitest';

import nextConfig, { browserSecurityHeaders } from '../../../next.config';

const headersByName = Object.fromEntries(
  browserSecurityHeaders.map(({ key, value }) => [key, value])
);

describe('encabezados HTTP de seguridad', () => {
  it('aplica el paquete de hardening a todas las rutas', async () => {
    const configured = await nextConfig.headers?.();

    expect(configured).toEqual([
      {
        source: '/:path*',
        headers: browserSecurityHeaders,
      },
    ]);
  });

  it('incorpora defensas de navegador no disruptivas', () => {
    expect(headersByName['X-Content-Type-Options']).toBe('nosniff');
    expect(headersByName['X-Frame-Options']).toBe('DENY');
    expect(headersByName['Referrer-Policy']).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(headersByName['Permissions-Policy']).toContain('camera=()');
    expect(headersByName['Permissions-Policy']).toContain('microphone=()');
    expect(headersByName['Cross-Origin-Opener-Policy']).toBe(
      'same-origin-allow-popups'
    );
    expect(headersByName['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });

  it('mantiene CSP en Report-Only durante la fase P2.0A', () => {
    const policy = headersByName['Content-Security-Policy-Report-Only'];

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
    );
    expect(headersByName['Content-Security-Policy']).toBeUndefined();
  });
});