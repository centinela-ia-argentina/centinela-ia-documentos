import assert from 'assert';
import {
  buildCheckpointEnvelope,
  serializeCheckpointEnvelope,
  formatSignedAt
} from '../ledger/checkpoint_envelope';

function testValidEnvelope() {
  const data = {
    algo: 'ed25519',
    canon_version: 2,
    head_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    key_id: 'test-key',
    org_id: '123e4567-e89b-12d3-a456-426614174000',
    seq_from: 1,
    seq_to: 10,
    signed_at: '2026-07-28T12:00:00.123456Z'
  };

  const envelope = buildCheckpointEnvelope(data);
  const serialized = serializeCheckpointEnvelope(envelope).toString('utf8');
  
  console.log('--- Prueba 1: Sobre valido y orden alfabetico ---');
  console.log(serialized);
  
  // 1. Check correct alphabetical order and structure
  const expectedKeys = ['algo', 'canon_version', 'head_hash', 'key_id', 'org_id', 'seq_from', 'seq_to', 'signed_at'];
  let lastIndex = -1;
  for (const k of expectedKeys) {
    const i = serialized.indexOf(`"${k}":`);
    assert(i > lastIndex, `Key ${k} is not in correct alphabetical order`);
    lastIndex = i;
  }
  console.log('PASA: Las ocho claves estan presentes y en orden ascendente.');

  // 2. Check no whitespaces
  console.log('\n--- Prueba 2: Sin espacios en blanco ---');
  assert(!/\s/.test(serialized), 'Serialized string contains whitespace');
  console.log('PASA: La cadena canonica no contiene espacios en blanco.');
  
  // 8. Dos llamadas con mismos datos producen misma cadena
  console.log('\n--- Prueba 8: Determinismo ---');
  const serialized2 = serializeCheckpointEnvelope(buildCheckpointEnvelope(data)).toString('utf8');
  assert.strictEqual(serialized, serialized2);
  console.log('PASA: Dos llamadas consecutivas generan exactamente la misma cadena.');
}

function testDateRoundtrip() {
  console.log('\n--- Prueba 3: Viaje de ida y vuelta de la fecha ---');
  
  const testFractions = ['123', '000', '010'];
  
  for (const frac of testFractions) {
    const initialIso = `2026-07-28T15:30:45.${frac}Z`;
    const d = new Date(initialIso);
    
    // Simulate PostgreSQL reading: formatting Date using formatSignedAt
    const env1 = buildCheckpointEnvelope({
      algo: 'ed25519', canon_version: 2, head_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', key_id: 'test',
      org_id: '123e4567-e89b-12d3-a456-426614174000', seq_from: 1, seq_to: 10,
      signed_at: d
    });
    const s1 = serializeCheckpointEnvelope(env1).toString('utf8');
    
    // Now simulate PG trimming trailing zeros on timestamptz output
    let pgString = initialIso;
    if (frac === '000') {
      pgString = '2026-07-28 15:30:45+00'; // PG might output it without fraction
    } else if (frac === '010') {
      pgString = '2026-07-28 15:30:45.01+00';
    } else {
      pgString = `2026-07-28 15:30:45.${frac}+00`;
    }
    
    const env2 = buildCheckpointEnvelope({
      algo: 'ed25519', canon_version: 2, head_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', key_id: 'test',
      org_id: '123e4567-e89b-12d3-a456-426614174000', seq_from: 1, seq_to: 10,
      signed_at: pgString
    });
    const s2 = serializeCheckpointEnvelope(env2).toString('utf8');
    
    assert.strictEqual(s1, s2, `Mismatch for fraction .${frac}000: ${s1} !== ${s2}`);
    assert(s1.includes(`"signed_at":"2026-07-28T15:30:45.${frac}000Z"`));
    console.log(`PASA: Fraccion .${frac}000 formatea a ${frac}000Z en ambos casos y genera cadena identica.`);
  }
}

function testHeadHashValidation() {
  console.log('\n--- Prueba 4 y 5: Validacion y normalizacion de head_hash ---');
  const baseData = {
    algo: 'ed25519', canon_version: 2, key_id: 'test', org_id: '123e4567-e89b-12d3-a456-426614174000',
    seq_from: 1, seq_to: 10, signed_at: new Date()
  };
  
  // 4. length != 64 rejected
  assert.throws(() => buildCheckpointEnvelope({ ...baseData, head_hash: '1234' }), /head_hash must be exactly 64/);
  console.log('PASA: head_hash de longitud distinta de 64 es rechazado.');
  
  // 5. prefix \x normalized
  const env = buildCheckpointEnvelope({
    ...baseData, head_hash: '\\x' + 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
  });
  assert.strictEqual(env.head_hash, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');
  console.log('PASA: head_hash con prefijo \\x es normalizado correctamente a 64 caracteres.');
}

function testOrgIdValidation() {
  console.log('\n--- Prueba 6: Normalizacion de org_id ---');
  const env = buildCheckpointEnvelope({
    algo: 'ed25519', canon_version: 2, head_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', key_id: 'test',
    org_id: '123E4567-E89B-12D3-A456-426614174000', // UPPERCASE
    seq_from: 1, seq_to: 10, signed_at: new Date()
  });
  assert.strictEqual(env.org_id, '123e4567-e89b-12d3-a456-426614174000');
  console.log('PASA: org_id en mayusculas es normalizado (convertido a minusculas). Documentado en codigo.');
}

function testExtraKeyRejected() {
  console.log('\n--- Prueba 7: Sobre con novena clave ---');
  const data = {
    algo: 'ed25519', canon_version: 2, head_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', key_id: 'test',
    org_id: '123e4567-e89b-12d3-a456-426614174000', seq_from: 1, seq_to: 10, signed_at: new Date(),
    extra_key: 'imposter'
  };
  assert.throws(() => buildCheckpointEnvelope(data), /Invalid key in envelope: extra_key/);
  console.log('PASA: Un sobre con una novena clave es rechazado.');
}

try {
  testValidEnvelope();
  testDateRoundtrip();
  testHeadHashValidation();
  testOrgIdValidation();
  testExtraKeyRejected();
  console.log('\nTodas las pruebas de A5 han pasado satisfactoriamente.');
} catch (err) {
  console.error('\nERROR EN PRUEBAS:', err);
  process.exit(1);
}
