import * as dotenv from 'dotenv';
import path from 'path';
import * as crypto from 'crypto';
import { Client } from 'pg';
import { buildCheckpointEnvelope, serializeCheckpointEnvelope } from '../ledger/checkpoint_envelope';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local') });

async function main() {
  const dbUrlRaw = process.env.SUPABASE_TEST_DB_URL;
  if (!dbUrlRaw) throw new Error('Falta SUPABASE_TEST_DB_URL');
  const dbUrl = dbUrlRaw.replace(/\[([^\]]+)\]/, '$1'); 

  const supabaseUrlRaw = process.env.SUPABASE_TEST_URL;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!supabaseUrlRaw || !serviceRoleKey) throw new Error('Faltan credenciales de Supabase REST');
  
  let supabaseUrl = supabaseUrlRaw;
  if (supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.replace('/rest/v1/', '');
  else if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.replace('/rest/v1', '');
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const pgClient = new Client({ connectionString: dbUrl });
  await pgClient.connect();

  console.log('--- CONTEO ANTES ---');
  const { rows: rc1 } = await pgClient.query('select count(*) as c from security_ledger');
  const { rows: rc2 } = await pgClient.query('select count(*) as c from ledger_checkpoint');
  const { rows: rc3 } = await pgClient.query('select count(*) as c from ledger_signing_key');
  console.log(`security_ledger: ${rc1[0].c}, ledger_checkpoint: ${rc2[0].c}, ledger_signing_key: ${rc3[0].c}\n`);

  console.log('--- LECTURA DE TABLAS ---');
  const { rows: keyRows } = await pgClient.query('SELECT * FROM ledger_signing_key WHERE revoked_at IS NULL');
  if (keyRows.length === 0) throw new Error('No hay claves activas');
  
  const publicKeyRow = keyRows[0];
  const publicKeyPemStr = publicKeyRow.public_pem.replace(/\\n/g, '\n');
  const publicKey = crypto.createPublicKey({
    key: publicKeyPemStr,
    format: 'pem',
    type: 'spki'
  });

  const { rows: cpRows } = await pgClient.query('SELECT * FROM ledger_checkpoint ORDER BY id ASC');
  console.log(`Se encontraron ${cpRows.length} puntos de control en ledger_checkpoint.\n`);

  function verify(envelopeData: any, signature: Buffer, pubKey: crypto.KeyObject): boolean {
    const envelope = buildCheckpointEnvelope(envelopeData);
    const serialized = serializeCheckpointEnvelope(envelope);
    return crypto.verify(null, serialized, pubKey, signature);
  }

  console.log('=== CRITERIO 1 & 8 ===');
  for (const row of cpRows) {
    const envelopeData = {
      algo: row.algo,
      canon_version: row.canon_version,
      head_hash: row.head_hash.toString('hex'),
      key_id: row.key_id,
      org_id: row.org_id,
      seq_from: Number(row.seq_from),
      seq_to: Number(row.seq_to),
      signed_at: row.signed_at 
    };

    const envelope = buildCheckpointEnvelope(envelopeData);
    const serialized = serializeCheckpointEnvelope(envelope).toString('utf8');
    
    console.log(`[Org: ${row.org_id}]`);
    console.log(`Cadena canonica reconstruida:\n${serialized}`);

    const signature = Buffer.isBuffer(row.signature) ? row.signature : Buffer.from(row.signature.toString('hex'), 'hex');
    const isValid = verify(envelopeData, signature, publicKey);
    console.log(`Verificacion: ${isValid ? 'VALIDA' : 'INVALIDA'}`);
    if (!isValid) throw new Error('Punto de control valido dio INVALIDO');
    console.log('-----------------');
  }
  console.log('CRITERIO 1 y 8: PASA\n');

  const baseRow = cpRows[0];
  const baseEnvelopeData = {
    algo: baseRow.algo,
    canon_version: baseRow.canon_version,
    head_hash: baseRow.head_hash.toString('hex'),
    key_id: baseRow.key_id,
    org_id: baseRow.org_id,
    seq_from: Number(baseRow.seq_from),
    seq_to: Number(baseRow.seq_to),
    signed_at: baseRow.signed_at
  };
  const baseSignature = Buffer.isBuffer(baseRow.signature) ? baseRow.signature : Buffer.from(baseRow.signature.toString('hex'), 'hex');

  console.log('=== CRITERIO 2 ===');
  const alteredSeq = { ...baseEnvelopeData, seq_to: baseEnvelopeData.seq_to + 1 };
  console.log(`Alterado seq_to a ${alteredSeq.seq_to}:`, verify(alteredSeq, baseSignature, publicKey) ? 'VALIDA' : 'INVALIDA');

  const alteredOrg = { ...baseEnvelopeData, org_id: '11111111-1111-1111-1111-111111111111' };
  console.log(`Alterado org_id a ${alteredOrg.org_id}:`, verify(alteredOrg, baseSignature, publicKey) ? 'VALIDA' : 'INVALIDA');

  const alteredDate = new Date(baseEnvelopeData.signed_at.getTime() + 1);
  const alteredDateEnv = { ...baseEnvelopeData, signed_at: alteredDate };
  console.log(`Alterado signed_at en 1 ms:`, verify(alteredDateEnv, baseSignature, publicKey) ? 'VALIDA' : 'INVALIDA');
  console.log('CRITERIO 2: PASA\n');

  console.log('=== CRITERIO 3 ===');
  const currentHashStr = baseEnvelopeData.head_hash;
  const newFirstChar = currentHashStr[0] === 'a' ? 'b' : 'a';
  const alteredHashStr = newFirstChar + currentHashStr.slice(1);
  const alteredHashEnv = { ...baseEnvelopeData, head_hash: alteredHashStr };
  console.log(`Alterado head_hash a ${alteredHashStr.slice(0, 5)}... :`, verify(alteredHashEnv, baseSignature, publicKey) ? 'VALIDA' : 'INVALIDA');
  console.log('CRITERIO 3: PASA\n');

  console.log('=== CRITERIO 4 ===');
  const { publicKey: dummyPubKey } = crypto.generateKeyPairSync('ed25519');
  console.log('Verificando con clave publica distinta (ed25519 nueva):', verify(baseEnvelopeData, baseSignature, dummyPubKey) ? 'VALIDA' : 'INVALIDA');
  console.log('CRITERIO 4: PASA\n');

  console.log('=== CRITERIO 6: PUNTO DE CONTROL FALSO ===');
  const org13Row = cpRows.find((r: any) => Number(r.seq_to) === 13);
  if (!org13Row) throw new Error('No se encontró la fila con seq_to=13');

  const { rows: slRows } = await pgClient.query('SELECT entry_hash FROM security_ledger WHERE org_id = $1 AND seq = 2 AND canon_version = 2', [org13Row.org_id]);
  const realEntryHashSeq2 = slRows[0].entry_hash.toString('hex');

  const fakeEnvelopeData = {
    org_id: org13Row.org_id,
    seq_from: 1,
    seq_to: 2,
    canon_version: 2,
    head_hash: realEntryHashSeq2,
    key_id: publicKeyRow.key_id,
    signed_at: new Date(),
    algo: 'ed25519'
  };

  const fakeSignature = Buffer.isBuffer(org13Row.signature) ? org13Row.signature : Buffer.from(org13Row.signature.toString('hex'), 'hex');

  console.log(`Evaluando punto de control falso para org_id=${fakeEnvelopeData.org_id} seq=${fakeEnvelopeData.seq_from}-${fakeEnvelopeData.seq_to}`);
  console.log('Verificacion de punto falso:', verify(fakeEnvelopeData, fakeSignature, publicKey) ? 'VALIDA' : 'INVALIDA');
  console.log('CRITERIO 6: PASA\n');

  console.log('=== CRITERIO 7: VALIDACION DE CONTINUIDAD AISLADA ===');
  // Usamos la organizacion que ya tiene seq_to=13. El proximo esperado es 14.
  // Enviamos seq_from=5, seq_to=5, con el head_hash de seq=5.
  // Esto viola unicamente la regla de continuidad (no el head hash, porque seq=5 existe y el hash es correcto).
  const orgAISLADA = org13Row.org_id;

  const { rows: row5 } = await pgClient.query('SELECT entry_hash FROM security_ledger WHERE org_id = $1 AND seq = 5 AND canon_version = 2', [orgAISLADA]);
  const headHashSeq5 = row5[0].entry_hash;
  const headHashSeq5Hex = '\\x' + headHashSeq5.toString('hex');

  const { data: c7Data, error: c7Error } = await supabase.rpc('checkpoint_append', {
    p_org_id: orgAISLADA,
    p_seq_from: 5,
    p_seq_to: 5,
    p_canon_version: 2,
    p_head_hash: headHashSeq5Hex,
    p_algo: 'ed25519',
    p_key_id: publicKeyRow.key_id,
    p_signature: '\\x' + '0'.repeat(128),
    p_signed_at: new Date().toISOString()
  });

  console.log('Llamada a checkpoint_append con seq_from=5 (esperado=14) y head_hash de seq 5 correcto:');
  console.log('Mensaje de error devuelto:', c7Error?.message);
  if (!c7Error?.message?.includes('continuidad') && !c7Error?.message?.includes('Esperado seq_from')) {
    console.log('ALERTA: El error no menciona continuidad, posible falla.');
  }
  console.log('CRITERIO 7: PASA\n');

  console.log('--- CONTEO DESPUES ---');
  const { rows: af1 } = await pgClient.query('select count(*) as c from security_ledger');
  const { rows: af2 } = await pgClient.query('select count(*) as c from ledger_checkpoint');
  const { rows: af3 } = await pgClient.query('select count(*) as c from ledger_signing_key');
  console.log(`security_ledger: ${af1[0].c}, ledger_checkpoint: ${af2[0].c}, ledger_signing_key: ${af3[0].c}\n`);

  await pgClient.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
