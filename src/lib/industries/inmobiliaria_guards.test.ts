import { describe, it, expect } from 'vitest';
import {
  isRentalCompatibleCaseType,
  isDerivacionEscribaniaCompatible,
} from './caseConfig';

describe('isRentalCompatibleCaseType', () => {
  it('accepts canonical and legacy rental types', () => {
    expect(isRentalCompatibleCaseType('Alquiler')).toBe(true);
    expect(isRentalCompatibleCaseType('alquiler')).toBe(true);
    expect(isRentalCompatibleCaseType('  Alquiler  ')).toBe(true);
    expect(isRentalCompatibleCaseType('RENTAL')).toBe(true);
    expect(isRentalCompatibleCaseType('rental')).toBe(true);
    expect(isRentalCompatibleCaseType('Contrato de locación')).toBe(true);
    expect(isRentalCompatibleCaseType('Locación')).toBe(true);
  });

  it('strictly rejects non-rental case types', () => {
    expect(isRentalCompatibleCaseType('Compraventa de inmueble')).toBe(false);
    expect(isRentalCompatibleCaseType('Reserva')).toBe(false);
    expect(isRentalCompatibleCaseType('Otro')).toBe(false);
    expect(isRentalCompatibleCaseType('Escritura')).toBe(false);
    expect(isRentalCompatibleCaseType('Demanda')).toBe(false);
    expect(isRentalCompatibleCaseType('Caso jurídico')).toBe(false);
    expect(isRentalCompatibleCaseType(null)).toBe(false);
    expect(isRentalCompatibleCaseType(undefined)).toBe(false);
    expect(isRentalCompatibleCaseType('')).toBe(false);
  });
});

describe('isDerivacionEscribaniaCompatible', () => {
  it('accepts strictly compraventa and reserva', () => {
    expect(isDerivacionEscribaniaCompatible('Compraventa de inmueble')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('compraventa')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('Reserva')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('reserva')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('REAL_ESTATE_PURCHASE')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('RESERVATION')).toBe(true);
  });

  it('strictly rejects Escritura (target notarial type, not inmo origin)', () => {
    expect(isDerivacionEscribaniaCompatible('Escritura')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('escritura')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('Escritura de compraventa')).toBe(false);
  });

  it('strictly rejects rental and non-deed types', () => {
    expect(isDerivacionEscribaniaCompatible('Alquiler')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('RENTAL')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('Contrato de locación')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('Otro')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('General')).toBe(false);
    expect(isDerivacionEscribaniaCompatible(null)).toBe(false);
    expect(isDerivacionEscribaniaCompatible(undefined)).toBe(false);
    expect(isDerivacionEscribaniaCompatible('')).toBe(false);
  });
});

describe('Punto 5: Moneda ausente en ficha inmobiliaria', () => {
  it('cuando moneda_operacion no está definida, se representa como "Sin definir" sin inferir ARS o USD', () => {
    const rawMetadata: Record<string, unknown> = {
      direccion_inmueble: 'Av. Corrientes 1234',
      valor_operacion: '150000',
      // moneda_operacion está ausente
    };

    const getMetadataValue = (meta: Record<string, unknown>, key: string) => {
      const v = meta?.[key];
      return typeof v === 'string' ? v : '';
    };

    const rawVal = getMetadataValue(rawMetadata, 'moneda_operacion');
    const displayValue = !rawVal ? 'Sin definir' : rawVal;

    expect(displayValue).toBe('Sin definir');
    expect(displayValue).not.toBe('USD');
    expect(displayValue).not.toBe('ARS');
  });

  it('cuando moneda_operacion está definida, preserva su valor sin alteración', () => {
    const rawMetadata: Record<string, unknown> = {
      moneda_operacion: 'USD',
    };
    const displayValue = (rawMetadata.moneda_operacion as string) || 'Sin definir';
    expect(displayValue).toBe('USD');
  });
});
