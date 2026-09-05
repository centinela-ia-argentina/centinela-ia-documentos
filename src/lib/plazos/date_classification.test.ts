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
  normalizarFechasPlazos,
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
    it('accepts deadlines with high or medium confidence, textual evidence, valid ISO and no review required', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Vencimiento para presentar memorial de agravios',
          fecha: '2026-09-15',
          tipo: 'procedural_deadline',
          confianza: 'alta',
          evidencia_textual: '...dentro del plazo perentorio de 5 días...',
          requiere_revision: false,
        })
      ).toBe(true);

      expect(
        evaluarFechaAccionable({
          descripcion: 'Audiencia testimonial fijada',
          fecha: '2026-10-02',
          tipo: 'hearing',
          confianza: 'media',
          evidencia_textual: 'Fíjase audiencia para el día 2 de octubre de 2026...',
          requiere_revision: false,
        })
      ).toBe(true);
    });

    it('rejects deadlines missing textual evidence', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Vencimiento sin cita textual',
          fecha: '2026-09-15',
          tipo: 'procedural_deadline',
          confianza: 'alta',
          evidencia_textual: '',
          requiere_revision: false,
        })
      ).toBe(false);
    });

    it('rejects deadlines with invalid non-ISO date formats', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Vencimiento con fecha en texto',
          fecha: '15 de septiembre de 2026',
          tipo: 'procedural_deadline',
          confianza: 'alta',
          evidencia_textual: '...el 15 de septiembre...',
          requiere_revision: false,
        })
      ).toBe(false);
    });

    it('rejects deadlines with low confidence even if procedural and with evidence', () => {
      expect(
        evaluarFechaAccionable({
          descripcion: 'Plazo para contestar demanda (detectado ambiguo)',
          fecha: '2026-09-20',
          tipo: 'procedural_deadline',
          confianza: 'baja',
          evidencia_textual: 'parece un plazo de 15 días',
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
          evidencia_textual: 'cédula con fecha tachada',
          requiere_revision: true,
        })
      ).toBe(false);
    });
  });

  describe('normalizarFechasPlazos: Normalización transversal para Legal, Escribanía e Inmobiliaria', () => {
    it('1. Legal: Procedural deadline with high confidence and evidence is preserved and actionable', () => {
      const raw = [{
        descripcion: 'Plazo para contestar demanda',
        fecha: '2026-09-20',
        tipo: 'procedural_deadline',
        confianza: 'alta',
        evidencia_textual: 'confiérase traslado por el término de 15 días',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].tipo).toBe('procedural_deadline');
      expect(normalized[0].confianza).toBe('alta');
      expect(normalized[0].evidencia_textual).toBe('confiérase traslado por el término de 15 días');
      expect(normalized[0].requiere_revision).toBe(false);
      expect(evaluarFechaAccionable(normalized[0])).toBe(true);
    });

    it('2. Legal: Hearing date with medium confidence is preserved and actionable', () => {
      const raw = [{
        descripcion: 'Audiencia de conciliación',
        fecha: '2026-10-10',
        tipo: 'hearing',
        confianza: 'media',
        evidencia_textual: 'audiencia a celebrarse el 10/10/2026',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(evaluarFechaAccionable(normalized[0])).toBe(true);
    });

    it('3. Legal: Low confidence marks requiere_revision and is NOT actionable', () => {
      const raw = [{
        descripcion: 'Vencimiento dudoso',
        fecha: '2026-09-30',
        tipo: 'procedural_deadline',
        confianza: 'baja',
        evidencia_textual: 'posible plazo',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('4. Legal: Missing textual evidence forces requiere_revision = true and is NOT actionable', () => {
      const raw = [{
        descripcion: 'Vencimiento sin evidencia',
        fecha: '2026-09-30',
        tipo: 'procedural_deadline',
        confianza: 'alta',
        evidencia_textual: '',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].requiere_revision).toBe(true);
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('5. Legal: Missing or invalid confidence defaults to baja + requiere_revision = true', () => {
      const raw = [{
        descripcion: 'Vencimiento sin confianza especificada',
        fecha: '2026-09-30',
        tipo: 'procedural_deadline',
        evidencia_textual: 'notifíquese',
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].confianza).toBe('baja');
      expect(normalized[0].requiere_revision).toBe(true);
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('6. Legal: Unknown date type falls back safely and forces requiere_revision = true', () => {
      const raw = [{
        descripcion: 'Algo raro',
        fecha: '2026-09-30',
        tipo: 'unsupported_custom_type',
        confianza: 'alta',
        evidencia_textual: 'texto',
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].requiere_revision).toBe(true);
    });

    it('7. Escribanía: Document expiration (certificado de dominio) is actionable when verified', () => {
      const raw = [{
        descripcion: 'Vencimiento de certificado de dominio',
        fecha: '2026-10-15',
        tipo: 'document_expiration',
        confianza: 'alta',
        evidencia_textual: 'Validez del certificado: 30 días corridos hasta 15/10/2026',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].tipo).toBe('document_expiration');
      expect(evaluarFechaAccionable(normalized[0])).toBe(true);
    });

    it('8. Escribanía: Past issue date (otorgamiento de escritura) is issue_date and non-actionable', () => {
      const raw = [{
        descripcion: 'Fecha de otorgamiento de la escritura pública',
        fecha: '2024-05-12',
        tipo: 'issue_date',
        confianza: 'alta',
        evidencia_textual: 'En la ciudad de Corrientes, a 12 de mayo de 2024',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].tipo).toBe('issue_date');
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('9. Escribanía: Ambiguous certificate date without evidence is not actionable', () => {
      const raw = [{
        descripcion: 'Certificado inhibición dudoso',
        fecha: '2026-11-01',
        tipo: 'document_expiration',
        confianza: 'media',
        evidencia_textual: '   ',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].requiere_revision).toBe(true);
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('10. Inmobiliaria: Lease expiration (contractual_deadline) is actionable when verified', () => {
      const raw = [{
        descripcion: 'Vencimiento de contrato de locación',
        fecha: '2027-03-31',
        tipo: 'contractual_deadline',
        confianza: 'alta',
        evidencia_textual: 'El presente contrato tendrá vigencia hasta el 31 de marzo de 2027',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].tipo).toBe('contractual_deadline');
      expect(evaluarFechaAccionable(normalized[0])).toBe(true);
    });

    it('11. Inmobiliaria: Monthly rental payment date is payment_date and non-actionable', () => {
      const raw = [{
        descripcion: 'Fecha de pago de alquiler mensual',
        fecha: '2026-06-10',
        tipo: 'payment_date',
        confianza: 'alta',
        evidencia_textual: 'pagadero del 1 al 10 de cada mes',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(normalized[0].tipo).toBe('payment_date');
      expect(evaluarFechaAccionable(normalized[0])).toBe(false);
    });

    it('12. Inmobiliaria: Purchase offer reservation deadline is contractual_deadline and actionable', () => {
      const raw = [{
        descripcion: 'Vencimiento de plazo de aceptación de oferta de compra',
        fecha: '2026-09-18',
        tipo: 'contractual_deadline',
        confianza: 'media',
        evidencia_textual: 'oferta vigente hasta el 18 de septiembre de 2026 inclusive',
        requiere_revision: false,
      }];
      const normalized = normalizarFechasPlazos(raw);
      expect(evaluarFechaAccionable(normalized[0])).toBe(true);
    });

    it('13. Cross-vertical: Corrupt or non-object entries are filtered out safely', () => {
      const raw = [null, undefined, 'string_invalido', 42, { descripcion: '', fecha: '' }];
      const normalized = normalizarFechasPlazos(raw as any);
      expect(normalized).toEqual([]);
    });
  });
});
