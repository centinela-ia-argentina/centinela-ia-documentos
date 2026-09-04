import { describe, it, expect } from 'vitest';
import {
  clasificarFecha,
  isActionableDate,
  esPlazoRadar,
  esPlazoAccionable,
  esFechaPago,
  esFechaNacimiento,
  esFechaEmision,
  ACTIONABLE_DATE_TYPES,
  NON_ACTIONABLE_DATE_TYPES,
} from './plazos';

describe('C-M3-J-004: Date taxonomy and operational vs informative deadlines', () => {
  it('identifies taxonomy sets correctly', () => {
    expect(ACTIONABLE_DATE_TYPES).toContain('procedural_deadline');
    expect(ACTIONABLE_DATE_TYPES).toContain('hearing');
    expect(ACTIONABLE_DATE_TYPES).toContain('limitation');
    expect(ACTIONABLE_DATE_TYPES).toContain('contractual_deadline');
    expect(ACTIONABLE_DATE_TYPES).toContain('document_expiration');

    expect(NON_ACTIONABLE_DATE_TYPES).toContain('informational');
    expect(NON_ACTIONABLE_DATE_TYPES).toContain('issue_date');
    expect(NON_ACTIONABLE_DATE_TYPES).toContain('payment_date');
  });

  describe('Non-actionable informative dates (paystubs, receipts, invoices, birth)', () => {
    it('classifies salary receipts as payment_date and rejects from Radar/Agenda', () => {
      const desc = 'Fecha de pago de haberes según recibo de sueldo';
      expect(clasificarFecha(desc)).toBe('payment_date');
      expect(esFechaPago(desc)).toBe(true);
      expect(isActionableDate(undefined, desc)).toBe(false);
      expect(esPlazoRadar(desc)).toBe(false);
      expect(esPlazoAccionable({ descripcion: desc, fecha: '2026-05-04' })).toBe(false);
    });

    it('classifies invoice issue dates as payment_date/issue_date and rejects from Radar', () => {
      const factura = 'Comprobante de pago factura Edenor';
      expect(clasificarFecha(factura)).toBe('payment_date');
      expect(isActionableDate(undefined, factura)).toBe(false);
      expect(esPlazoRadar(factura)).toBe(false);

      const emision = 'Fecha de emisión del comprobante';
      expect(clasificarFecha(emision)).toBe('issue_date');
      expect(esFechaEmision(emision)).toBe(true);
      expect(isActionableDate(undefined, emision)).toBe(false);
      expect(esPlazoRadar(emision)).toBe(false);
    });

    it('classifies birth dates and biographical data as informational and rejects from Radar', () => {
      const desc = 'Fecha de nacimiento del causante';
      expect(clasificarFecha(desc)).toBe('informational');
      expect(esFechaNacimiento(desc)).toBe(true);
      expect(isActionableDate(undefined, desc)).toBe(false);
      expect(esPlazoRadar(desc)).toBe(false);
    });
  });

  describe('Actionable operational deadlines (judicial, hearings, contracts, expirations)', () => {
    it('classifies judicial hearings as hearing and accepts to Radar', () => {
      const audiencia = 'Audiencia de conciliación art. 360 CPCCN';
      expect(clasificarFecha(audiencia)).toBe('hearing');
      expect(isActionableDate('hearing', audiencia)).toBe(true);
      expect(esPlazoRadar(audiencia)).toBe(true);
    });

    it('classifies summons and procedural deadlines as procedural_deadline and accepts to Radar', () => {
      const plazo = 'Vencimiento de plazo para contestar demanda';
      expect(clasificarFecha(plazo)).toBe('procedural_deadline');
      expect(isActionableDate('procedural_deadline', plazo)).toBe(true);
      expect(esPlazoRadar(plazo)).toBe(true);

      const cedula = 'Cédula de notificación traslado de demanda';
      expect(clasificarFecha(cedula)).toBe('procedural_deadline');
      expect(isActionableDate('procedural_deadline', cedula)).toBe(true);
      expect(esPlazoRadar(cedula)).toBe(true);
    });

    it('classifies prescription and statute of limitations as limitation', () => {
      const prescripcion = 'Plazo de prescripción de la acción de cobro';
      expect(clasificarFecha(prescripcion)).toBe('limitation');
      expect(isActionableDate('limitation', prescripcion)).toBe(true);
      expect(esPlazoRadar(prescripcion)).toBe(true);
    });

    it('classifies document and certificate expiration as document_expiration', () => {
      const cert = 'Vencimiento de certificado de dominio inmobiliario';
      expect(clasificarFecha(cert)).toBe('document_expiration');
      expect(isActionableDate('document_expiration', cert)).toBe(true);
      expect(esPlazoRadar(cert)).toBe(true);
    });

    it('classifies lease term and contractual maturity as contractual_deadline', () => {
      const contrato = 'Vencimiento contrato de locación';
      expect(clasificarFecha(contrato)).toBe('contractual_deadline');
      expect(isActionableDate('contractual_deadline', contrato)).toBe(true);
      expect(esPlazoRadar(contrato)).toBe(true);
    });
  });
});
