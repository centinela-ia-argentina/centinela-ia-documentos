import { describe, it, expect } from 'vitest';
import { sugerirModeloNotarialPorTipo, MODELOS } from './modelos';

describe('Modelos Notariales — Sugerencias estrictas y facultades de Poder Especial', () => {
  describe('Sugerencia unívoca y sin ampliaciones indebidas (sugerirModeloNotarialPorTipo)', () => {
    it('sugiere "notarial-poder-especial" para "Poder especial administración" y nunca poder general amplio', () => {
      const modelo = sugerirModeloNotarialPorTipo('Poder especial administración');
      expect(modelo).not.toBeNull();
      expect(modelo?.id).toBe('notarial-poder-especial');
    });

    it('sugiere "notarial-poder-especial" para "Poder especial"', () => {
      const modelo = sugerirModeloNotarialPorTipo('Poder especial');
      expect(modelo?.id).toBe('notarial-poder-especial');
    });

    it('sugiere "notarial-poder-general-amplio" solo cuando se califica explícitamente como general', () => {
      const modelo = sugerirModeloNotarialPorTipo('Poder general amplio');
      expect(modelo?.id).toBe('notarial-poder-general-amplio');
    });

    it('no sugiere modelo más amplio si el poder es genérico o ambiguo (devuelve null para selección manual)', () => {
      const modelo = sugerirModeloNotarialPorTipo('Poder');
      expect(modelo).toBeNull();
    });

    it('sugiere "notarial-acta-constatacion" solo si se tipifica expresamente como constatación', () => {
      const modelo = sugerirModeloNotarialPorTipo('Acta de constatación notarial');
      expect(modelo?.id).toBe('notarial-acta-constatacion');
    });

    it('no sugiere acta de constatación para un acta genérica sin tipificar (devuelve null)', () => {
      const modelo = sugerirModeloNotarialPorTipo('Acta notarial');
      expect(modelo).toBeNull();
    });

    it('no sugiere cesión para una sucesión genérica (devuelve null)', () => {
      const modelo = sugerirModeloNotarialPorTipo('Sucesión');
      expect(modelo).toBeNull();
    });

    it('sugiere "notarial-cesion-derechos-hereditarios" cuando se especifica cesión de derechos hereditarios', () => {
      const modelo = sugerirModeloNotarialPorTipo('Cesión de derechos hereditarios');
      expect(modelo?.id).toBe('notarial-cesion-derechos-hereditarios');
    });

    it('sugiere "notarial-certificacion-firmas" para certificación de firmas', () => {
      const modelo = sugerirModeloNotarialPorTipo('Certificación de firmas');
      expect(modelo?.id).toBe('notarial-certificacion-firmas');
    });

    it('sugiere "notarial-compraventa-inmueble" para escritura de compraventa de inmueble', () => {
      const modelo = sugerirModeloNotarialPorTipo('Compraventa de inmueble');
      expect(modelo?.id).toBe('notarial-compraventa-inmueble');
    });
  });

  describe('Gobernanza de contenido: Poder Especial no concede facultades amplias por defecto', () => {
    const poderEspecial = MODELOS.find((m) => m.id === 'notarial-poder-especial');

    it('el modelo "notarial-poder-especial" existe en el catálogo', () => {
      expect(poderEspecial).toBeDefined();
      expect(poderEspecial?.reviewStatus).toBe('pending_review');
    });

    it('el cuerpo del Poder Especial no contiene facultades de disposición por defecto (vender, hipotecar, gravar)', () => {
      const cuerpo = (poderEspecial?.cuerpo ?? '').toLowerCase();
      expect(cuerpo).not.toContain('vender');
      expect(cuerpo).not.toContain('comprar');
      expect(cuerpo).not.toContain('permutar');
      expect(cuerpo).not.toContain('hipotecar');
      expect(cuerpo).not.toContain('gravar');
      expect(cuerpo).not.toContain('disponer de bienes');
    });

    it('el cuerpo del Poder Especial no contiene facultades bancarias por defecto (cuentas, cheques, créditos)', () => {
      const cuerpo = (poderEspecial?.cuerpo ?? '').toLowerCase();
      expect(cuerpo).not.toContain('bancarias');
      expect(cuerpo).not.toContain('cuentas');
      expect(cuerpo).not.toContain('cheques');
      expect(cuerpo).not.toContain('créditos');
    });

    it('el cuerpo del Poder Especial no contiene facultades judiciales por defecto (estar en juicio)', () => {
      const cuerpo = (poderEspecial?.cuerpo ?? '').toLowerCase();
      expect(cuerpo).not.toContain('estar en juicio');
      expect(cuerpo).not.toContain('demandado');
      expect(cuerpo).not.toContain('poderes judiciales');
    });

    it('el cuerpo del Poder Especial delimita estrictamente el alcance al objeto y caducidad', () => {
      const cuerpo = poderEspecial?.cuerpo ?? '';
      expect(cuerpo).toContain('{{objeto_poder}}');
      expect(cuerpo).toContain('{{facultades}}');
      expect(cuerpo).toContain('se limita estrictamente al objeto indicado');
    });
  });
});
