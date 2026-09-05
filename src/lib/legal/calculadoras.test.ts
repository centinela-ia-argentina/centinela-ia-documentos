import { describe, it, expect } from 'vitest';
import { UMA_VALOR, UHOM_VALOR, JUS_BA_MEDIACION, JUS_CORRIENTES, LEGAL_PARAMETERS } from './config';
import { diasAmpliacionPorDistancia } from './plazos';
import {
  calcularCaducidadBase,
  sumarMesesControlado,
  calcularEscalaArt21,
  calcularDanosPunitivos,
  calcularIncapacidad,
  calcularProrrateo,
  calcularMediacion,
  calcMediacionNacion,
  calcMediacionBA,
  calcMediacionCorrientes,
  TRAMOS_ART21,
} from './calculadoras';
import {
  calcularLiquidacionLaboral,
  calcularAntiguedadExacta,
  esBisiesto,
  parseDateStrict,
} from './liquidacion';

describe('Calculadoras Jurídicas: Funciones Productivas Oficiales', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Caducidad de Instancia (Art. 310 CPCCN)
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Caducidad de instancia (calcularCaducidadBase y sumarMesesControlado)', () => {
    it('applies 6 months for 1ª o única instancia (art. 310 inc. 1 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'primera',
      });
      expect(res.meses).toBe(6);
      expect(res.norma).toBe('Art. 310 inc. 1 CPCCN');
      expect(res.detalle).toContain('1ª o única instancia');
      expect(res.fechaBaseEstimadaISO).toBe('2026-09-15');
      expect(res.aviso).toContain('Fecha base aritmética');
    });

    it('applies 3 months for 2ª o ulterior instancia (art. 310 inc. 2 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'segunda',
      });
      expect(res.meses).toBe(3);
      expect(res.norma).toBe('Art. 310 inc. 2 CPCCN');
      expect(res.fechaBaseEstimadaISO).toBe('2026-06-15');
    });

    it('applies 3 months for incidentes generales, ejecuciones especiales y juicio sumarísimo (art. 310 inc. 2 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'sumarisimo_ejecucion_incidentes',
      });
      expect(res.meses).toBe(3);
      expect(res.norma).toBe('Art. 310 inc. 2 CPCCN');
      expect(res.detalle).toContain('Incidentes generales, ejecuciones especiales y juicio sumarísimo');
      expect(res.fechaBaseEstimadaISO).toBe('2026-06-15');
    });

    it('applies lesser prescription term when specified and valid (art. 310 inc. 3 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'prescripcion_menor',
        mesesPrescripcionMenor: 2,
        plazoOrdinarioReferencia: 3,
      });
      expect(res.meses).toBe(2);
      expect(res.norma).toBe('Art. 310 inc. 3 CPCCN');
      expect(res.fechaBaseEstimadaISO).toBe('2026-05-15');
    });

    it('rejects art. 310 inc. 3 if mesesPrescripcionMenor is missing, non-positive, or >= ordinary term', () => {
      expect(() =>
        calcularCaducidadBase({
          fechaUltimoActo: '2026-03-15',
          tipo: 'prescripcion_menor',
        })
      ).toThrow('debe especificarse el plazo de prescripción menor');

      expect(() =>
        calcularCaducidadBase({
          fechaUltimoActo: '2026-03-15',
          tipo: 'prescripcion_menor',
          mesesPrescripcionMenor: 0,
        })
      ).toThrow('debe especificarse el plazo de prescripción menor');

      expect(() =>
        calcularCaducidadBase({
          fechaUltimoActo: '2026-03-15',
          tipo: 'prescripcion_menor',
          mesesPrescripcionMenor: 3,
          plazoOrdinarioReferencia: 3,
        })
      ).toThrow('debe ser inferior al plazo procesal ordinario');
    });

    it('applies 1 month for incidente de caducidad de instancia (art. 310 inc. 4 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'incidente_caducidad',
      });
      expect(res.meses).toBe(1);
      expect(res.norma).toBe('Art. 310 inc. 4 CPCCN');
      expect(res.detalle).toContain('Incidente de caducidad');
      expect(res.fechaBaseEstimadaISO).toBe('2026-04-15');
    });

    it('controls end-of-month clamping without Date.setMonth overshoot (e.g. 31 Jan)', () => {
      const d1 = new Date(2026, 0, 31);
      const res1 = sumarMesesControlado(d1, 1);
      expect(res1.getFullYear()).toBe(2026);
      expect(res1.getMonth()).toBe(1); // February
      expect(res1.getDate()).toBe(28);

      const d2 = new Date(2024, 0, 31);
      const res2 = sumarMesesControlado(d2, 1);
      expect(res2.getFullYear()).toBe(2024);
      expect(res2.getMonth()).toBe(1);
      expect(res2.getDate()).toBe(29);

      const d3 = new Date(2026, 7, 31);
      const res3 = sumarMesesControlado(d3, 6);
      expect(res3.getFullYear()).toBe(2027);
      expect(res3.getMonth()).toBe(1);
      expect(res3.getDate()).toBe(28);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Honorarios Ley 27.423: Continuidad y Tramos (calcularEscalaArt21)
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Honorarios Ley 27.423 (calcularEscalaArt21)', () => {
    it('compares explicitly all percentages and tranches of TRAMOS_ART21 with official scale', () => {
      const officialScale = [
        { hastaUMA: 15, minPct: 22, maxPct: 33, maxAcumuladoAnterior: 0 },
        { hastaUMA: 45, minPct: 20, maxPct: 26, maxAcumuladoAnterior: 4.95 },
        { hastaUMA: 90, minPct: 18, maxPct: 24, maxAcumuladoAnterior: 12.75 },
        { hastaUMA: 150, minPct: 17, maxPct: 22, maxAcumuladoAnterior: 23.55 },
        { hastaUMA: 450, minPct: 15, maxPct: 20, maxAcumuladoAnterior: 36.75 },
        { hastaUMA: 750, minPct: 13, maxPct: 17, maxAcumuladoAnterior: 96.75 },
        { hastaUMA: Infinity, minPct: 12, maxPct: 15, maxAcumuladoAnterior: 147.75 },
      ];

      expect(TRAMOS_ART21.length).toBe(officialScale.length);
      for (let i = 0; i < officialScale.length; i++) {
        expect(TRAMOS_ART21[i].hastaUMA).toBe(officialScale[i].hastaUMA);
        expect(TRAMOS_ART21[i].minPct).toBe(officialScale[i].minPct);
        expect(TRAMOS_ART21[i].maxPct).toBe(officialScale[i].maxPct);
        expect(TRAMOS_ART21[i].maxAcumuladoAnterior).toBeCloseTo(officialScale[i].maxAcumuladoAnterior, 4);
      }
    });

    const testPoints = [1, 15, 15.5, 16, 45, 46, 90, 91, 150, 151, 450, 451, 750, 751];

    it.each(testPoints)('evaluates continuity and bounds at %s UMA', (umaCount) => {
      const montoPesos = umaCount * UMA_VALOR;
      const res = calcularEscalaArt21(montoPesos, UMA_VALOR);

      expect(res.montoUMA).toBeCloseTo(umaCount, 4);
      expect(res.hMinUMA).toBeGreaterThan(0);
      expect(res.hMaxUMA).toBeGreaterThan(res.hMinUMA);
      expect(res.hMinPesos).toBeCloseTo(res.hMinUMA * UMA_VALOR, 2);
      expect(res.hMaxPesos).toBeCloseTo(res.hMaxUMA * UMA_VALOR, 2);
    });

    it('validates exact mathematical continuity across boundaries', () => {
      // At 1 UMA: 0.22 to 0.33 UMA
      const r1 = calcularEscalaArt21(1 * UMA_VALOR, UMA_VALOR);
      expect(r1.hMinUMA).toBeCloseTo(0.22, 4);
      expect(r1.hMaxUMA).toBeCloseTo(0.33, 4);

      // At 15 UMA: Grade 1 max is 15 * 0.33 = 4.95 UMA. Min is 15 * 0.22 = 3.30 UMA.
      const r15 = calcularEscalaArt21(15 * UMA_VALOR, UMA_VALOR);
      expect(r15.hMinUMA).toBeCloseTo(3.30, 4);
      expect(r15.hMaxUMA).toBeCloseTo(4.95, 4);

      // At 15.5 UMA: Does NOT discard decimal fraction!
      // Excess = 0.5. hMin = 4.95 + 0.5 * 0.20 = 5.05. hMax = 4.95 + 0.5 * 0.26 = 5.08.
      const r15_5 = calcularEscalaArt21(15.5 * UMA_VALOR, UMA_VALOR);
      expect(r15_5.montoUMA).toBeCloseTo(15.5, 4);
      expect(r15_5.hMinUMA).toBeCloseTo(5.05, 4);
      expect(r15_5.hMaxUMA).toBeCloseTo(5.08, 4);

      // At 16 UMA: Excess = 1. hMin = 4.95 + 1 * 0.20 = 5.15. hMax = 4.95 + 1 * 0.26 = 5.21.
      const r16 = calcularEscalaArt21(16 * UMA_VALOR, UMA_VALOR);
      expect(r16.hMinUMA).toBeCloseTo(5.15, 4);
      expect(r16.hMaxUMA).toBeCloseTo(5.21, 4);

      // At 45 UMA: Grade 2 max = 4.95 + 30 * 0.26 = 12.75. Min = 4.95 + 30 * 0.20 = 10.95.
      const r45 = calcularEscalaArt21(45 * UMA_VALOR, UMA_VALOR);
      expect(r45.hMinUMA).toBeCloseTo(10.95, 4);
      expect(r45.hMaxUMA).toBeCloseTo(12.75, 4);

      // At 46 UMA: Grade 3 (18% - 24%). Excess = 1 over 45.
      // hMin = 12.75 + 1 * 0.18 = 12.93. hMax = 12.75 + 1 * 0.24 = 12.99.
      const r46 = calcularEscalaArt21(46 * UMA_VALOR, UMA_VALOR);
      expect(r46.hMinUMA).toBeCloseTo(12.93, 4);
      expect(r46.hMaxUMA).toBeCloseTo(12.99, 4);

      // At 90 UMA: Grade 3 max = 12.75 + 45 * 0.24 = 23.55. Min = 12.75 + 45 * 0.18 = 20.85.
      const r90 = calcularEscalaArt21(90 * UMA_VALOR, UMA_VALOR);
      expect(r90.hMinUMA).toBeCloseTo(20.85, 4);
      expect(r90.hMaxUMA).toBeCloseTo(23.55, 4);

      // At 91 UMA: Grade 4 (17% - 22%). Excess = 1 over 90.
      // hMin = 23.55 + 1 * 0.17 = 23.72. hMax = 23.55 + 1 * 0.22 = 23.77.
      const r91 = calcularEscalaArt21(91 * UMA_VALOR, UMA_VALOR);
      expect(r91.hMinUMA).toBeCloseTo(23.72, 4);
      expect(r91.hMaxUMA).toBeCloseTo(23.77, 4);

      // At 150 UMA: Grade 4 max = 23.55 + 60 * 0.22 = 36.75. Min = 23.55 + 60 * 0.17 = 33.75.
      const r150 = calcularEscalaArt21(150 * UMA_VALOR, UMA_VALOR);
      expect(r150.hMinUMA).toBeCloseTo(33.75, 4);
      expect(r150.hMaxUMA).toBeCloseTo(36.75, 4);

      // At 151 UMA: Grade 5 (15% - 20%). Excess = 1 over 150.
      // hMin = 36.75 + 1 * 0.15 = 36.90. hMax = 36.75 + 1 * 0.20 = 36.95.
      const r151 = calcularEscalaArt21(151 * UMA_VALOR, UMA_VALOR);
      expect(r151.hMinUMA).toBeCloseTo(36.90, 4);
      expect(r151.hMaxUMA).toBeCloseTo(36.95, 4);

      // At 450 UMA: Grade 5 max = 36.75 + 300 * 0.20 = 96.75. Min = 36.75 + 300 * 0.15 = 81.75.
      const r450 = calcularEscalaArt21(450 * UMA_VALOR, UMA_VALOR);
      expect(r450.hMinUMA).toBeCloseTo(81.75, 4);
      expect(r450.hMaxUMA).toBeCloseTo(96.75, 4);

      // At 451 UMA: Grade 6 (13% - 17%). Excess = 1 over 450.
      // hMin = 96.75 + 1 * 0.13 = 96.88. hMax = 96.75 + 1 * 0.17 = 96.92.
      const r451 = calcularEscalaArt21(451 * UMA_VALOR, UMA_VALOR);
      expect(r451.hMinUMA).toBeCloseTo(96.88, 4);
      expect(r451.hMaxUMA).toBeCloseTo(96.92, 4);

      // At 750 UMA: Grade 6 max = 96.75 + 300 * 0.17 = 147.75. Min = 96.75 + 300 * 0.13 = 135.75.
      const r750 = calcularEscalaArt21(750 * UMA_VALOR, UMA_VALOR);
      expect(r750.hMinUMA).toBeCloseTo(135.75, 4);
      expect(r750.hMaxUMA).toBeCloseTo(147.75, 4);

      // At 751 UMA: Grade 7 (12% - 15%). Excess = 1 over 750.
      // hMin = 147.75 + 1 * 0.12 = 147.87. hMax = 147.75 + 1 * 0.15 = 147.90.
      const r751 = calcularEscalaArt21(751 * UMA_VALOR, UMA_VALOR);
      expect(r751.hMinUMA).toBeCloseTo(147.87, 4);
      expect(r751.hMaxUMA).toBeCloseTo(147.90, 4);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Liquidación Laboral (calcularLiquidacionLaboral)
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Liquidación laboral (calcularLiquidacionLaboral)', () => {
    const baseSueldo = 1000000;

    it('rejects invalid dates strictly like 2026-02-31', () => {
      expect(() => parseDateStrict('2026-02-31')).toThrow('no existe en el mes');
      expect(() =>
        calcularLiquidacionLaboral({
          remuneracion: baseSueldo,
          fechaIngreso: '2026-02-31',
          fechaEgreso: '2026-03-15',
        })
      ).toThrow('no existe en el mes');
    });

    it('handles período de prueba standard (6 meses Ley 27.742 / 27.802): sin art. 245, sin preaviso ni integración', () => {
      // 5 months under 6-month probation
      const res5m = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-06-01',
      });
      expect(res5m.enPeriodoPrueba).toBe(true);
      expect(res5m.indemnizacionAntiguedad).toBe(0);
      expect(res5m.aniosComputablesArt245).toBe(0);
      expect(res5m.preavisoBase).toBe(0);
      expect(res5m.integracionTotal).toBe(0);
      expect(res5m.advertencias[0]).toContain('período de prueba');
      expect(res5m.advertencias[0]).toContain('6 meses');

      // Exactly 6 months
      const res6m = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-07-01',
      });
      expect(res6m.enPeriodoPrueba).toBe(true);
      expect(res6m.indemnizacionAntiguedad).toBe(0);
      expect(res6m.preavisoBase).toBe(0);

      // Greater than 6 months (6 months and 1 day)
      const resPost = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-07-02',
      });
      expect(resPost.enPeriodoPrueba).toBe(false);
      expect(resPost.aniosComputablesArt245).toBe(1);
      expect(resPost.indemnizacionAntiguedad).toBe(baseSueldo);
      expect(resPost.preavisoBase).toBe(baseSueldo); // <= 5 años = 1 mes
    });

    it('handles CCT probation limits: 8 months and 12 months', () => {
      // 7 months with 8-month CCT limit -> still in probation
      const res8m = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-08-01',
        plazoPeriodoPruebaMeses: 8,
      });
      expect(res8m.enPeriodoPrueba).toBe(true);
      expect(res8m.indemnizacionAntiguedad).toBe(0);

      // 10 months with 12-month CCT limit -> still in probation
      const res12m = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-11-01',
        plazoPeriodoPruebaMeses: 12,
      });
      expect(res12m.enPeriodoPrueba).toBe(true);
      expect(res12m.indemnizacionAntiguedad).toBe(0);

      // 12 months and 2 days -> probation concluded
      const res12mPost = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2025-01-01',
        fechaEgreso: '2026-01-03',
        plazoPeriodoPruebaMeses: 12,
      });
      expect(res12mPost.enPeriodoPrueba).toBe(false);
      expect(res12mPost.indemnizacionAntiguedad).toBe(baseSueldo);
    });

    it('handles renuncia o pérdida del período de prueba por el empleador', () => {
      const resRenuncia = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-03-01',
        renunciaOPerdidaPeriodoPrueba: true,
      });
      expect(resRenuncia.enPeriodoPrueba).toBe(false);
      expect(resRenuncia.indemnizacionAntiguedad).toBe(baseSueldo);
      expect(resRenuncia.advertencias.some((a) => a.includes('renuncia o pérdida'))).toBe(true);
    });

    it('handles régimen fondo_cese: omits art. 245 and calculates subtotalRubrosComunes', () => {
      const resCese = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-15',
        regimen: 'fondo_cese',
        cctFondoCese: 'UOCRA CCT 222/71',
      });
      expect(resCese.indemnizacionAntiguedad).toBe(0);
      expect(resCese.aniosComputablesArt245).toBe(0);
      expect(resCese.subtotalRubrosComunes).toBeGreaterThan(0);
      expect(resCese.subtotalRubrosComunes).toBe(
        resCese.preavisoTotal +
        resCese.integracionTotal +
        resCese.vacacionesNoGozadas +
        resCese.sacProporcional
      );
      expect(resCese.advertencias.some((a) => a.includes('Fondo o sistema de cese laboral'))).toBe(true);
    });

    it('handles fracción exacta de 3 meses (no supera fracción > 3 meses): no suma año extra', () => {
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2025-01-01',
        fechaEgreso: '2026-04-01',
      });
      expect(res.anios).toBe(1);
      expect(res.meses).toBe(3);
      expect(res.dias).toBe(0);
      expect(res.aniosComputablesArt245).toBe(1);
      expect(res.indemnizacionAntiguedad).toBe(baseSueldo * 1);
    });

    it('handles fracción mayor de 3 meses (ej: 1 año, 3 meses y 1 día): suma un año extra', () => {
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2025-01-01',
        fechaEgreso: '2026-04-02',
      });
      expect(res.anios).toBe(1);
      expect(res.meses).toBe(3);
      expect(res.dias).toBe(1);
      expect(res.aniosComputablesArt245).toBe(2);
      expect(res.indemnizacionAntiguedad).toBe(baseSueldo * 2);
    });

    it('handles antigüedad de 5 años: preaviso 2 meses y 21 días de vacaciones', () => {
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2021-03-01',
        fechaEgreso: '2026-03-01',
      });
      expect(res.anios).toBe(5);
      expect(res.aniosComputablesArt245).toBe(5);
      expect(res.indemnizacionAntiguedad).toBe(baseSueldo * 5);
      expect(res.preavisoBase).toBe(baseSueldo * 2);
      expect(res.diasVacacionesEscala).toBe(21);
    });

    it('handles egreso el último día del mes: integración = 0', () => {
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-31',
        huboPreaviso: false,
      });
      expect(res.esUltimoDiaMes).toBe(true);
      expect(res.integracionTotal).toBe(0);
    });

    it('compares con preaviso vs sin preaviso', () => {
      const conPreaviso = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-15',
        huboPreaviso: true,
      });
      expect(conPreaviso.preavisoTotal).toBe(0);
      expect(conPreaviso.integracionTotal).toBe(0);

      const sinPreaviso = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-15',
        huboPreaviso: false,
      });
      expect(sinPreaviso.preavisoTotal).toBeGreaterThan(0);
      expect(sinPreaviso.integracionTotal).toBeGreaterThan(0);
    });

    it('compares con y sin integración manual', () => {
      const sinIntegracion = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-15',
        correspondeIntegracion: false,
      });
      expect(sinIntegracion.integracionTotal).toBe(0);
    });

    it('handles cambio de año y año bisiesto correctamente', () => {
      expect(esBisiesto(2024)).toBe(true);
      expect(esBisiesto(2026)).toBe(false);

      const resBisiesto = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2023-01-01',
        fechaEgreso: '2024-03-01',
      });
      expect(resBisiesto.anios).toBe(1);
      expect(resBisiesto.meses).toBe(2);
      expect(resBisiesto.vacacionesBase).toBeGreaterThan(0);

      const { anios, meses, dias } = calcularAntiguedadExacta(new Date(2025, 9, 15), new Date(2026, 2, 20));
      expect(anios).toBe(0);
      expect(meses).toBe(5);
      expect(dias).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Daños Punitivos (calcularDanosPunitivos)
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Daños punitivos (calcularDanosPunitivos)', () => {
    it('computes Irigoyen Testa formula D = C * (1 - Pc) / Pc and includes mandatory non-binding notice', () => {
      const C = 1000000;
      const Pc = 0.8;
      const res = calcularDanosPunitivos(C, Pc);

      expect(res.compensatoria).toBe(1000000);
      expect(res.probabilidad).toBe(0.8);
      expect(res.punitivo).toBeCloseTo(250000, 2);
      expect(res.total).toBeCloseTo(1250000, 2);
      expect(res.advertencia).toContain('Simulación doctrinal — fórmula Irigoyen Testa');
      expect(res.advertencia).toContain('El art. 52 bis de la Ley 24.240 no establece esta fórmula como método obligatorio');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Prorrateo 25% Art. 730 CCyCN (calcularProrrateo)
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Prorrateo de costas art. 730 CCyCN (calcularProrrateo)', () => {
    it('applies 25% cap when fees exceed limit and provides cautionary statement on excess', () => {
      const res = calcularProrrateo(10000000, 3500000);
      expect(res.tope25).toBe(2500000);
      expect(res.excedeTope).toBe(true);
      expect(res.aCargoCondenado).toBe(2500000);
      expect(res.excedente).toBe(1000000);
      expect(res.factorProrrateo).toBeCloseTo(2500000 / 3500000, 4);
      expect(res.notaExcedente).toBe(
        'El alcance del excedente y la eventual obligación frente al profesional requieren analizar la relación contractual, los conceptos regulados y la normativa aplicable.'
      );
    });

    it('does not reduce fees when below 25%', () => {
      const res = calcularProrrateo(10000000, 2000000);
      expect(res.excedeTope).toBe(false);
      expect(res.aCargoCondenado).toBe(2000000);
      expect(res.excedente).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Mediación Prejudicial Oficial (calcularMediacion)
  // ──────────────────────────────────────────────────────────────────────────
  describe('6. Mediación prejudicial oficial (calcularMediacion)', () => {
    it('computes Nación via UHOM', () => {
      const rNac = calcMediacionNacion({
        tipo: 'patrimonial',
        monto: 1000000,
        audiencias: 2,
        valorUHOM: UHOM_VALOR,
      });
      expect(rNac.basicoUHOM).toBeGreaterThan(0);
      expect(rNac.totalPesos).toBeGreaterThan(0);
      expect(rNac.provisionalPesos).toBe(2 * UHOM_VALOR);
    });

    it('computes PBA via Jus Ley 14.967 y Dec. 600/21 art. 31', () => {
      const rBA = calcMediacionBA({
        monto: 5000000,
        indeterminado: false,
        valorJus: JUS_BA_MEDIACION,
      });
      expect(rBA.honJus).toBeGreaterThan(0);
      expect(rBA.anticipoPesos).toBe(JUS_BA_MEDIACION);
      expect(rBA.norma).toContain('Decreto 600/21 art. 31');
    });

    it('computes Corrientes via Ac. 14/22', () => {
      const rC = calcMediacionCorrientes({
        resultado: 'acuerdo',
        tipo: 'patrimonial',
        monto: 2000000,
        cuotaMensual: 0,
        valorJus: JUS_CORRIENTES,
      });
      expect(rC.honPesos).toBe(2000000 * 0.05); // 5% por acuerdo
      expect(rC.norma).toContain('Acuerdo STJ Corrientes 14/22');
    });
  });
});
