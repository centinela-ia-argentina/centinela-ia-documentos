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
} from './calculadoras';
import {
  calcularLiquidacionLaboral,
  calcularAntiguedadExacta,
  esBisiesto,
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

    it('applies lesser prescription term when specified (art. 310 inc. 3 CPCCN)', () => {
      const res = calcularCaducidadBase({
        fechaUltimoActo: '2026-03-15',
        tipo: 'prescripcion_menor',
        mesesPrescripcionMenor: 2,
      });
      expect(res.meses).toBe(2);
      expect(res.norma).toBe('Art. 310 inc. 3 CPCCN');
      expect(res.fechaBaseEstimadaISO).toBe('2026-05-15');
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
      // 31 Jan 2026 + 1 month -> must be 28 Feb 2026 (non-leap), NOT 2 or 3 March!
      const d1 = new Date(2026, 0, 31);
      const res1 = sumarMesesControlado(d1, 1);
      expect(res1.getFullYear()).toBe(2026);
      expect(res1.getMonth()).toBe(1); // February
      expect(res1.getDate()).toBe(28);

      // In leap year 2024: 31 Jan 2024 + 1 month -> 29 Feb 2024
      const d2 = new Date(2024, 0, 31);
      const res2 = sumarMesesControlado(d2, 1);
      expect(res2.getFullYear()).toBe(2024);
      expect(res2.getMonth()).toBe(1);
      expect(res2.getDate()).toBe(29);

      // 31 Aug 2026 + 6 months -> Feb 2027 (28 days)
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
    // Tests across all required boundary points:
    // 1, 15, 15.5, 16, 45, 46, 90, 91, 150, 151, 450, 451, 750, 751 UMA.
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

      // At 46 UMA: Grade 3 (18% - 23%). Excess = 1 over 45.
      // hMin = 12.75 + 1 * 0.18 = 12.93. hMax = 12.75 + 1 * 0.23 = 12.98.
      const r46 = calcularEscalaArt21(46 * UMA_VALOR, UMA_VALOR);
      expect(r46.hMinUMA).toBeCloseTo(12.93, 4);
      expect(r46.hMaxUMA).toBeCloseTo(12.98, 4);

      // At 90 UMA: Grade 3 max = 12.75 + 45 * 0.23 = 23.10. Min = 12.75 + 45 * 0.18 = 20.85.
      const r90 = calcularEscalaArt21(90 * UMA_VALOR, UMA_VALOR);
      expect(r90.hMinUMA).toBeCloseTo(20.85, 4);
      expect(r90.hMaxUMA).toBeCloseTo(23.10, 4);

      // At 91 UMA: Grade 4 (17% - 20%). Excess = 1 over 90.
      // hMin = 23.10 + 1 * 0.17 = 23.27. hMax = 23.10 + 1 * 0.20 = 23.30.
      const r91 = calcularEscalaArt21(91 * UMA_VALOR, UMA_VALOR);
      expect(r91.hMinUMA).toBeCloseTo(23.27, 4);
      expect(r91.hMaxUMA).toBeCloseTo(23.30, 4);

      // At 150 UMA: Grade 4 max = 23.10 + 60 * 0.20 = 35.10. Min = 23.10 + 60 * 0.17 = 33.30.
      const r150 = calcularEscalaArt21(150 * UMA_VALOR, UMA_VALOR);
      expect(r150.hMinUMA).toBeCloseTo(33.30, 4);
      expect(r150.hMaxUMA).toBeCloseTo(35.10, 4);

      // At 151 UMA: Grade 5 (15% - 18%). Excess = 1 over 150.
      // hMin = 35.10 + 1 * 0.15 = 35.25. hMax = 35.10 + 1 * 0.18 = 35.28.
      const r151 = calcularEscalaArt21(151 * UMA_VALOR, UMA_VALOR);
      expect(r151.hMinUMA).toBeCloseTo(35.25, 4);
      expect(r151.hMaxUMA).toBeCloseTo(35.28, 4);

      // At 450 UMA: Grade 5 max = 35.10 + 300 * 0.18 = 89.10. Min = 35.10 + 300 * 0.15 = 80.10.
      const r450 = calcularEscalaArt21(450 * UMA_VALOR, UMA_VALOR);
      expect(r450.hMinUMA).toBeCloseTo(80.10, 4);
      expect(r450.hMaxUMA).toBeCloseTo(89.10, 4);

      // At 451 UMA: Grade 6 (13% - 15%). Excess = 1 over 450.
      // hMin = 89.10 + 1 * 0.13 = 89.23. hMax = 89.10 + 1 * 0.15 = 89.25.
      const r451 = calcularEscalaArt21(451 * UMA_VALOR, UMA_VALOR);
      expect(r451.hMinUMA).toBeCloseTo(89.23, 4);
      expect(r451.hMaxUMA).toBeCloseTo(89.25, 4);

      // At 750 UMA: Grade 6 max = 89.10 + 300 * 0.15 = 134.10. Min = 89.10 + 300 * 0.13 = 128.10.
      const r750 = calcularEscalaArt21(750 * UMA_VALOR, UMA_VALOR);
      expect(r750.hMinUMA).toBeCloseTo(128.10, 4);
      expect(r750.hMaxUMA).toBeCloseTo(134.10, 4);

      // At 751 UMA: Grade 7 (11% - 12%). Excess = 1 over 750.
      // hMin = 134.10 + 1 * 0.11 = 134.21. hMax = 134.10 + 1 * 0.12 = 134.22.
      const r751 = calcularEscalaArt21(751 * UMA_VALOR, UMA_VALOR);
      expect(r751.hMinUMA).toBeCloseTo(134.21, 4);
      expect(r751.hMaxUMA).toBeCloseTo(134.22, 4);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Liquidación Laboral (calcularLiquidacionLaboral)
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Liquidación laboral (calcularLiquidacionLaboral)', () => {
    const baseSueldo = 1000000;

    it('handles menos de 3 meses (período de prueba art. 92 bis): indemnización art. 245 = 0', () => {
      // 2 months and 10 days
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2026-01-01',
        fechaEgreso: '2026-03-11',
      });
      expect(res.enPeriodoPrueba).toBe(true);
      expect(res.indemnizacionAntiguedad).toBe(0);
      expect(res.aniosComputablesArt245).toBe(0);
      // Preaviso en período de prueba es 15 días si no hubo preaviso
      expect(res.preavisoBase).toBe(500000);
      // Integración no aplica en período de prueba
      expect(res.integracionTotal).toBe(0);
      expect(res.advertencias[0]).toContain('período de prueba');
    });

    it('handles explicit período de prueba concluido = false', () => {
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2025-10-01',
        fechaEgreso: '2026-02-01',
        periodoPruebaConcluido: false,
      });
      expect(res.enPeriodoPrueba).toBe(true);
      expect(res.indemnizacionAntiguedad).toBe(0);
    });

    it('handles fracción exacta de 3 meses (no supera fracción > 3 meses): no suma año extra', () => {
      // 1 año y exactamente 3 meses (ej: 2025-01-01 a 2026-04-01)
      const res = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2025-01-01',
        fechaEgreso: '2026-04-01',
      });
      expect(res.anios).toBe(1);
      expect(res.meses).toBe(3);
      expect(res.dias).toBe(0);
      // art. 245: "fracción mayor de 3 meses", so exactly 3 months computes 1 year
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
      // Preaviso >= 5 años = 2 meses + SAC
      expect(res.preavisoBase).toBe(baseSueldo * 2);
      expect(res.diasVacacionesEscala).toBe(21);
    });

    it('handles egreso el último día del mes: integración = 0', () => {
      // 31 de marzo
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
      // Con preaviso
      const conPreaviso = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2026-03-15',
        huboPreaviso: true,
      });
      expect(conPreaviso.preavisoTotal).toBe(0);
      expect(conPreaviso.integracionTotal).toBe(0);

      // Sin preaviso
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

      // Egreso en 2024 (bisiesto): año tiene 366 días
      const resBisiesto = calcularLiquidacionLaboral({
        remuneracion: baseSueldo,
        fechaIngreso: '2023-01-01',
        fechaEgreso: '2024-03-01',
      });
      expect(resBisiesto.anios).toBe(1);
      expect(resBisiesto.meses).toBe(2);
      expect(resBisiesto.vacacionesBase).toBeGreaterThan(0);

      // Cambio de año: ingreso en octubre 2025, egreso en marzo 2026
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
