import { describe, it, expect } from 'vitest';
import { evaluarMatch } from '../match';
import { ClientRecord } from '@/types/client';
import { PropertyRecord } from '@/types/property';

describe('evaluarMatch', () => {
  const baseClient = {
    id: 'client-1',
    organization_id: 'org-1',
    status: 'activo',
    currency: 'USD'
  } as ClientRecord;

  const baseProperty = {
    id: 'prop-1',
    organization_id: 'org-1',
    status: 'disponible',
    currency: 'USD'
  } as PropertyRecord;

  it('debería normalizar y matchear correctamente PÁLERMO con Palermo', () => {
    const client = { ...baseClient, desired_neighborhood: 'PÁLERMO' };
    const property = { ...baseProperty, neighborhood: 'Palermo' };

    const result = evaluarMatch(client, property);
    const zonaMatch = result.criterios.find(c => c.key === 'zona');
    
    expect(zonaMatch?.aplica).toBe(true);
    expect(zonaMatch?.cumple).toBe(true);
  });

  it('debería hacer fallback a address si neighborhood está vacío', () => {
    const client = { ...baseClient, desired_neighborhood: 'Belgrano' };
    const property = { ...baseProperty, neighborhood: '', address: 'Av. Cabildo 2000, Belgrano, CABA' };

    const result = evaluarMatch(client, property);
    const zonaMatch = result.criterios.find(c => c.key === 'zona');
    
    expect(zonaMatch?.aplica).toBe(true);
    expect(zonaMatch?.cumple).toBe(true);
  });

  it('NO debería hacer fallback a address si neighborhood está definido pero no coincide', () => {
    const client = { ...baseClient, desired_neighborhood: 'Belgrano' };
    // El barrio oficial es Núñez, aunque la dirección diga Belgrano, no debe cruzar
    const property = { ...baseProperty, neighborhood: 'Núñez', address: 'Limítrofe con Belgrano' };

    const result = evaluarMatch(client, property);
    const zonaMatch = result.criterios.find(c => c.key === 'zona');
    
    expect(zonaMatch?.aplica).toBe(true);
    expect(zonaMatch?.cumple).toBe(false);
  });

  it('NO debería matchear fragmentos cortos (Recoleta en Palermo)', () => {
    const client = { ...baseClient, desired_neighborhood: 'Recoleta' };
    const property = { ...baseProperty, neighborhood: 'Palermo' };

    const result = evaluarMatch(client, property);
    const zonaMatch = result.criterios.find(c => c.key === 'zona');
    
    expect(zonaMatch?.aplica).toBe(true);
    expect(zonaMatch?.cumple).toBe(false);
  });
});
