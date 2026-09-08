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
  it('accepts compraventa and reserva', () => {
    expect(isDerivacionEscribaniaCompatible('Compraventa de inmueble')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('Reserva')).toBe(true);
    expect(isDerivacionEscribaniaCompatible('Escritura')).toBe(true);
  });

  it('strictly rejects rental and non-deed types', () => {
    expect(isDerivacionEscribaniaCompatible('Alquiler')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('RENTAL')).toBe(false);
    expect(isDerivacionEscribaniaCompatible('Contrato de locación')).toBe(false);
    expect(isDerivacionEscribaniaCompatible(null)).toBe(false);
    expect(isDerivacionEscribaniaCompatible(undefined)).toBe(false);
    expect(isDerivacionEscribaniaCompatible('')).toBe(false);
  });
});
