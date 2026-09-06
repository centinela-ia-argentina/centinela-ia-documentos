import { describe, it, expect } from 'vitest';
import { puntuarCoincidencia, sugerirCoincidencias, DocumentoParaMatch } from './checklistMatch';

describe('checklistMatch - Exclusiones de jurisdicción y partes', () => {
  it('no cruza requerimiento ARBA con documento de AGIP/CABA', () => {
    const docAgip: DocumentoParaMatch = {
      id: 'doc-1',
      file_name: 'libre_deuda_agip_caba.pdf',
      document_type: 'comprobante_impuesto',
    };

    const score = puntuarCoincidencia('Informe de deuda ARBA (PBA)', docAgip);
    expect(score).toBe(0);
  });

  it('no cruza requerimiento AGIP con documento de ARBA', () => {
    const docArba: DocumentoParaMatch = {
      id: 'doc-2',
      file_name: 'impuesto_inmobiliario_arba_pba.pdf',
      document_type: 'comprobante_impuesto',
    };

    const score = puntuarCoincidencia('Boleta / Libre deuda AGIP / ABL (CABA)', docArba);
    expect(score).toBe(0);
  });

  it('no asigna el DNI de la parte vendedora a la parte compradora', () => {
    const docVendedor: DocumentoParaMatch = {
      id: 'doc-dni-vendedor',
      file_name: 'DNI_parte_vendedora_frente_dorso.pdf',
      document_type: 'dni',
    };

    const scoreComprador = puntuarCoincidencia('DNI de la parte compradora', docVendedor);
    expect(scoreComprador).toBe(0);

    const scoreVendedor = puntuarCoincidencia('DNI de la parte vendedora', docVendedor);
    expect(scoreVendedor).toBeGreaterThan(20);
  });

  it('no asigna el DNI de la parte compradora a la parte vendedora', () => {
    const docComprador: DocumentoParaMatch = {
      id: 'doc-dni-comprador',
      file_name: 'dni_comprador_titular.pdf',
      document_type: 'dni',
    };

    const scoreVendedor = puntuarCoincidencia('DNI de la parte vendedora', docComprador);
    expect(scoreVendedor).toBe(0);

    const scoreComprador = puntuarCoincidencia('DNI de la parte compradora', docComprador);
    expect(scoreComprador).toBeGreaterThan(20);
  });

  it('sugerirCoincidencias distribuye correctamente DNIs distintos para cada parte sin duplicar asignación', () => {
    const items = [
      { title: 'DNI de la parte vendedora' },
      { title: 'DNI de la parte compradora' },
    ];

    const documentos: DocumentoParaMatch[] = [
      {
        id: 'doc-c',
        file_name: 'DNI_comprador_firma.pdf',
        document_type: 'dni',
      },
      {
        id: 'doc-v',
        file_name: 'DNI_vendedor_titular.pdf',
        document_type: 'dni',
      },
    ];

    const sugerencias = sugerirCoincidencias(items, documentos);

    const matchVendedor = sugerencias.get('DNI de la parte vendedora');
    const matchComprador = sugerencias.get('DNI de la parte compradora');

    expect(matchVendedor).toBeDefined();
    expect(matchVendedor?.documentId).toBe('doc-v');

    expect(matchComprador).toBeDefined();
    expect(matchComprador?.documentId).toBe('doc-c');
  });
});
