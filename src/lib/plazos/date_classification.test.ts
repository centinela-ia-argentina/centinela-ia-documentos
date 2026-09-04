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
  evaluarFechaAccionable,
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
  });

  describe('Demanda context disambiguation', () => {
    it('does NOT classify generic phrases containing "demanda" (e.g. demanda de servicios) as procedural_deadline', () => {
      const generic1 = 'Estimación de demanda de servicios técnicos';
      expect(clasificarFecha(generic1)).not.toBe('procedural_deadline');
      expect(clasificarFecha(generic1)).toBe('informational');
      expect(isActionableDate(undefined, generic1)).toBe(false);

      const generic2 = 'Comportamiento de la curva de demanda del mercado';
      expect(clasificarFecha(generic2)).not.toBe('procedural_deadline');
      expect(clasificarFecha(generic2)).toBe('informational');

      const generic3 = 'Demanda de empleo en el sector inmobiliario';
      expect(clasificarFecha(generic3)).not.toBe('procedural_deadline');
      expect(clasificarFecha(generic3)).toBe('informational');
    });

    it('classifies procedural acts with demanda (traslado, contestación, cédula, interposición) as procedural_deadline', () => {
      expect(clasificarFecha('Traslado de demanda laboral')).toBe('procedural_deadline');
      expect(clasificarFecha('Contestación de demanda')).toBe('procedural_deadline');
      expect(clasificarFecha('Cédula de demanda recibida')).toBe('procedural_deadline');
      expect(clasificarFecha('Plazo para contestar demanda')).toBe('procedural_deadline');
      expect(clasificarFecha('Interposición de demanda sumarísima')).toBe('procedural_deadline');
    });
  });

  describe('Confidence, Evidence, and Human Review Flag (evaluarFechaAccionable)', () => {
    it('accepts deadlines with high or medium confidence without review required', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Vencimiento para presentar memorial de agravios',
          fecha: '2026-09-15',
          tipo: 'procedural_deadline',
          confianza: 'alta',
          requiere_revision: false,
        })
      ).toBe(true);

      expect(
        evaluarFechaAccionable({
          descripcion: 'Audiencia testimonial fijada',
          fecha: '2026-10-02',
          tipo: 'hearing',
          confianza: 'media',
          requiere_revision: false,
        })
      ).toBe(true);
    });

    it('rejects deadlines with low confidence even if procedural', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Plazo para contestar demanda (detectado ambiguo)',
          fecha: '2026-09-20',
          tipo: 'procedural_deadline',
          confianza: 'baja',
          requiere_revision: false,
        })
      ).toBe(false);
    });

    it('rejects deadlines flagged as requiring human review', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Fecha contradictoria en cédula de traslado',
          fecha: '2026-09-25',
          tipo: 'procedural_deadline',
          confianza: 'alta',
          requiere_revision: true,
        })
      ).toBe(false);
    });
  });
});
