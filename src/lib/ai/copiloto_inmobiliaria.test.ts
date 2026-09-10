import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/plazos/fechasCanonicas', () => ({
  analizarPlazoBoletoEscritura: vi.fn(),
  parsearFechaCualquiera: vi.fn(),
  formatIsoToAr: vi.fn(),
}));

import { sanitizarTerminologiaInmobiliaria } from './copiloto';

describe('sanitizarTerminologiaInmobiliaria', () => {
  it('replaces judicial terminology with inmobiliaria terms', () => {
    const raw = 'El presente expediente trata sobre una compraventa. En este expediente se analiza la etapa procesal y el riesgo procesal. Hubo varias actuaciones.';
    const sanitized = sanitizarTerminologiaInmobiliaria(raw);
    expect(sanitized).not.toContain('expediente');
    expect(sanitized).not.toContain('etapa procesal');
    expect(sanitized).not.toContain('riesgo procesal');
    expect(sanitized).not.toContain('actuaciones');
    expect(sanitized).toContain('operación');
    expect(sanitized).toContain('movimientos');
  });

  it('handles case variations', () => {
    expect(sanitizarTerminologiaInmobiliaria('del expediente')).toBe('de la operación');
    expect(sanitizarTerminologiaInmobiliaria('al expediente')).toBe('a la operación');
    expect(sanitizarTerminologiaInmobiliaria('este expediente')).toBe('esta operación');
    expect(sanitizarTerminologiaInmobiliaria('de este caso')).toBe('de esta operación');
  });
});
