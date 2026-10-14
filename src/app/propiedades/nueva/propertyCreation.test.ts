import { describe, expect, it } from 'vitest';
import { creationDefaults, prepareCreationPayload } from './propertyCreation';
function source(values: Record<string, string> = {}) { const data = new FormData(); for (const [key, value] of Object.entries({ ...creationDefaults, name: 'Fixture', ...values })) data.set(key, value); return data; }
describe('creation-only number serialization', () => {
  it.each([['82.50', '82,50'], ['0.50', '0,50'], ['0', '0'], ['0.00', '0,00'], ['185000', '185000'], ['185000.25', '185000,25'], ['-0.50', '-0,50'], ['.50', ',50'], ['1.2e3', '1,2e3'], ['1e3', '1e3'], ['', ''], [' 82.50 ', '82,50']])('adapts %s without rounding', (input, output) => {
    const result = prepareCreationPayload(source({ surface_total_m2: input, surface_covered_m2: input, price: input }));
    expect(result.state.error).toBeNull(); for (const key of ['surface_total_m2', 'surface_covered_m2', 'price']) expect(result.data.get(key)).toBe(output);
  });
  it.each(['NaN', 'Infinity', '1e999', '82,50', '1.234.56', '0x10', '1 500', 'abc'])('rejects noncanonical/invalid value %s', value => {
    const result = prepareCreationPayload(source({ price: value })); expect(result.state.field).toBe('price'); expect(result.state.error).toBeTruthy();
  });
  it('returns field-specific feedback without altering source', () => { const data = source({ surface_covered_m2: 'invalid' }); expect(prepareCreationPayload(data).state.field).toBe('surface_covered_m2'); expect(data.get('surface_covered_m2')).toBe('invalid'); });
  it('preserves 17 field contract and excludes injected server/publication identities', () => {
    const data = source({ name: ' Fixture ', owners: 'Fixture owner', notes: 'Fixture notes', publication_status: 'publicada', organization_id: 'attacker', property_id: 'wrong' });
    const result = prepareCreationPayload(data); expect(Array.from(result.data.keys())).toHaveLength(17); expect(result.data.get('name')).toBe('Fixture'); expect(result.data.get('owners')).toBe('Fixture owner'); expect(result.data.get('notes')).toBe('Fixture notes'); for (const key of ['publication_status', 'organization_id', 'property_id']) expect(result.data.has(key)).toBe(false); expect(data.get('name')).toBe(' Fixture ');
  });
  it.each(['', '   '])('requires trimmed name %s', name => expect(prepareCreationPayload(source({ name })).state.field).toBe('name'));
  it('rejects file field instead of stringifying it', () => { const data = source(); data.set('price', new Blob(['fixture']), 'fixture.txt'); expect(prepareCreationPayload(data).state.field).toBe('price'); });
});
