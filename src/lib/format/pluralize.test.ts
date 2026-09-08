import { describe, it, expect } from 'vitest';
import {
  plural,
  pluralDocumento,
  pluralDocumentoAnalizado,
  pluralDocumentoVencido,
  pluralDocumentoPorVencer,
  pluralOperacion,
  pluralHito,
  pluralDia,
} from './pluralize';

describe('pluralize helpers', () => {
  it('correctly handles singular and plural for documentos', () => {
    expect(pluralDocumento(1)).toBe('1 documento');
    expect(pluralDocumento(0)).toBe('0 documentos');
    expect(pluralDocumento(5)).toBe('5 documentos');
  });

  it('correctly handles singular and plural for documentos analizados', () => {
    expect(pluralDocumentoAnalizado(1)).toBe('1 documento analizado');
    expect(pluralDocumentoAnalizado(2)).toBe('2 documentos analizados');
  });

  it('correctly handles singular and plural for documentos vencidos y por vencer', () => {
    expect(pluralDocumentoVencido(1)).toBe('1 documento vencido');
    expect(pluralDocumentoVencido(3)).toBe('3 documentos vencidos');
    expect(pluralDocumentoPorVencer(1)).toBe('1 documento por vencer');
    expect(pluralDocumentoPorVencer(4)).toBe('4 documentos por vencer');
  });

  it('correctly handles singular and plural for operaciones e hitos', () => {
    expect(pluralOperacion(1)).toBe('1 operación');
    expect(pluralOperacion(8)).toBe('8 operaciones');
    expect(pluralHito(1)).toBe('1 hito');
    expect(pluralHito(12)).toBe('12 hitos');
  });

  it('correctly handles singular and plural for dias', () => {
    expect(pluralDia(1)).toBe('1 día');
    expect(pluralDia(7)).toBe('7 días');
  });

  it('generic plural function works with custom nouns', () => {
    expect(plural(1, 'escritura', 'escrituras')).toBe('1 escritura');
    expect(plural(3, 'escritura', 'escrituras')).toBe('3 escrituras');
  });
});
