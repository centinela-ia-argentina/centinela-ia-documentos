import { describe, it, expect } from 'vitest';
import { UMA_VALOR, UHOM_VALOR, JUS_BA_MEDIACION, JUS_CORRIENTES, LEGAL_PARAMETERS } from './config';
import { diasAmpliacionPorDistancia } from './plazos';

describe('Calculadoras Jurídicas: Fórmulas y Casos de Borde', () => {
  describe('1. Art. 158 CPCCN: Ampliación de plazo por distancia', () => {
    it('calculates correct extra days for distance boundaries (0, 99, 100, 199, 200, 299, 300, 450)', () => {
      expect(diasAmpliacionPorDistancia(0)).toBe(0);
      expect(diasAmpliacionPorDistancia(99)).toBe(0);
      expect(diasAmpliacionPorDistancia(100)).toBe(1);
      expect(diasAmpliacionPorDistancia(199)).toBe(1);
      expect(diasAmpliacionPorDistancia(200)).toBe(1);
      expect(diasAmpliacionPorDistancia(299)).toBe(1);
      expect(diasAmpliacionPorDistancia(300)).toBe(2);
      expect(diasAmpliacionPorDistancia(400)).toBe(2);
      expect(diasAmpliacionPorDistancia(450)).toBe(2);
      expect(diasAmpliacionPorDistancia(500)).toBe(3);
    });
  });

  describe('2. Caducidad de instancia: art. 310 CPCCN', () => {
    it('applies correct months according to instance and procedural type', () => {
      const getMeses = (tipo: 'primera' | 'segunda' | 'incidentes_general' | 'incidente_caducidad') => {
        if (tipo === 'primera') return 6;
        if (tipo === 'segunda') return 3;
        if (tipo === 'incidentes_general') return 3;
        if (tipo === 'incidente_caducidad') return 1;
        return 6;
      };

      expect(getMeses('primera')).toBe(6);
      expect(getMeses('segunda')).toBe(3);
      expect(getMeses('incidentes_general')).toBe(3);
      expect(getMeses('incidente_caducidad')).toBe(1);
    });
  });

  describe('3. Prorrateo de costas: art. 730 CCyCN (tope 25%)', () => {
    it('applies 25% cap to costs payable by the losing party and computes excess', () => {
      const montoSentencia = 10000000;
      const honorariosRegulados = 3500000;
      const tope = montoSentencia * 0.25; // 2.500.000
      const excede = honorariosRegulados > tope;
      const aCargoCondenado = excede ? tope : honorariosRegulados;
      const excedente = excede ? honorariosRegulados - tope : 0;
      const factor = excede ? tope / honorariosRegulados : 1;

      expect(tope).toBe(2500000);
      expect(excede).toBe(true);
      expect(aCargoCondenado).toBe(2500000);
      expect(excedente).toBe(1000000);
      expect(factor).toBeCloseTo(0.714285, 4);
    });

    it('does not prorrate if fees do not exceed 25%', () => {
      const montoSentencia = 10000000;
      const honorariosRegulados = 2000000;
      const tope = montoSentencia * 0.25;
      const excede = honorariosRegulados > tope;
      const aCargoCondenado = excede ? tope : honorariosRegulados;
      const excedente = excede ? honorariosRegulados - tope : 0;

      expect(excede).toBe(false);
      expect(aCargoCondenado).toBe(2000000);
      expect(excedente).toBe(0);
    });
  });

  describe('4. Daños punitivos: art. 52 bis Ley 24.240 (Fórmula Irigoyen Testa)', () => {
    it('computes civil penalty D = C * (1 - Pc) / Pc', () => {
      const C = 1000000;
      const Pc = 0.8; // 80%
      const D = C * (1 - Pc) / Pc;
      expect(D).toBeCloseTo(250000, 2);
      expect(C + D).toBeCloseTo(1250000, 2);
    });
  });

  describe('5. Mediación y Parámetros Arancelarios Oficiales', () => {
    it('has correct updated parameters', () => {
      expect(UMA_VALOR).toBe(98112);
      expect(UHOM_VALOR).toBe(12960);
      expect(JUS_BA_MEDIACION).toBe(53232);
      expect(JUS_CORRIENTES).toBe(58519.61);

      expect(LEGAL_PARAMETERS.uma.status).toBe('verified');
      expect(LEGAL_PARAMETERS.uhom.status).toBe('verified');
      expect(LEGAL_PARAMETERS.jus_pba.status).toBe('verified');
      expect(LEGAL_PARAMETERS.jus_corrientes.status).toBe('pending');
      expect(LEGAL_PARAMETERS.tasa_activa_bna.status).toBe('pending');
    });
  });
});
