import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test.local') });

async function verifyAll() {
  const dbUrl = (process.env.SUPABASE_TEST_DB_URL || '').replace(':[', ':').replace(']@', '@');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('--- VERIFICACIÓN DE CRITERIOS DE ACEPTACIÓN DE ENDURECIMIENTO ---\n');

  try {
    // Criterio 1: Triggers en modo ALWAYS
    const res1 = await client.query(`
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgrelid = 'security_ledger'::regclass 
        AND tgname IN ('trigger_abort_ledger_update_delete', 'trigger_abort_ledger_truncate', 'trigger_validate_ledger_insert')
      ORDER BY tgname;
    `);
    console.log('[Criterio 1] Triggers en modo ALWAYS (tgenabled = A):');
    console.table(res1.rows);
    if (res1.rows.length === 3 && res1.rows.every(r => r.tgenabled === 'A')) {
      console.log('✅ Criterio 1 PASA');
    } else {
      console.error('❌ Criterio 1 FALLA');
    }

    // Criterio 2: Delete con session_replication_role = replica
    console.log('\n[Criterio 2] Intento de DELETE en modo replica...');
    const orgTest2 = crypto.randomUUID();
    await client.query(`SELECT ledger_append($1, 'system', 'test', 'INIT', null, null, '{}'::jsonb)`, [orgTest2]);
    try {
      await client.query('BEGIN;');
      await client.query('SET session_replication_role = replica;');
      await client.query('DELETE FROM security_ledger WHERE org_id = $1;', [orgTest2]);
      console.error('❌ Criterio 2 FALLA: El DELETE no arrojó error.');
    } catch (e: any) {
      await client.query('ROLLBACK;');
      await client.query('RESET session_replication_role;');
      console.log('✅ Criterio 2 PASA: Falló como se esperaba ->', e.message);
    }

    // Criterio 3: Insert directo con seq salteado
    console.log('\n[Criterio 3] Intento de INSERT directo con seq salteado...');
    try {
      await client.query(`
        INSERT INTO security_ledger(org_id, seq, occurred_at, actor_type, actor_id, action, payload, prev_hash, entry_hash)
        VALUES ($1, 5, now(), 'system', 'tester', 'TEST_ACTION', '{}'::jsonb, decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
      `, [crypto.randomUUID()]);
      console.error('❌ Criterio 3 FALLA: El insert con seq salteado no arrojó error.');
    } catch (e: any) {
      console.log('✅ Criterio 3 PASA: Falló como se esperaba ->', e.message);
    }

    // Criterio 4: Insert directo con prev_hash inventado
    console.log('\n[Criterio 4] Intento de INSERT directo con prev_hash inventado...');
    try {
      await client.query(`
        INSERT INTO security_ledger(org_id, seq, occurred_at, actor_type, actor_id, action, payload, prev_hash, entry_hash)
        VALUES ($1, 1, now(), 'system', 'tester', 'TEST_ACTION', '{}'::jsonb, decode('deadbeef00000000000000000000000000000000000000000000000000000000', 'hex'), decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
      `, [crypto.randomUUID()]);
      console.error('❌ Criterio 4 FALLA: El insert con prev_hash inventado no arrojó error.');
    } catch (e: any) {
      console.log('✅ Criterio 4 PASA: Falló como se esperaba ->', e.message);
    }

    // Criterio 5: Insert directo con entry_hash incorrecto
    console.log('\n[Criterio 5] Intento de INSERT directo con entry_hash incorrecto...');
    try {
      await client.query(`
        INSERT INTO security_ledger(org_id, seq, occurred_at, actor_type, actor_id, action, payload, prev_hash, entry_hash)
        VALUES ($1, 1, now(), 'system', 'tester', 'TEST_ACTION', '{}'::jsonb, decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), decode('deadc0de00000000000000000000000000000000000000000000000000000000', 'hex'))
      `, [crypto.randomUUID()]);
      console.error('❌ Criterio 5 FALLA: El insert con entry_hash incorrecto no arrojó error.');
    } catch (e: any) {
      console.log('✅ Criterio 5 PASA: Falló como se esperaba ->', e.message);
    }

    // Criterio 6: ledger_append inserta correctamente y la cadena queda sin enlaces rotos
    console.log('\n[Criterio 6] Verificar funcionamiento de ledger_append y cadena sin enlaces rotos...');
    const orgTest6 = crypto.randomUUID();
    await client.query(`SELECT ledger_append($1, 'system', 'actor', 'ACT1', 'obj', '1', '{"test":1}'::jsonb)`, [orgTest6]);
    await client.query(`SELECT ledger_append($1, 'system', 'actor', 'ACT2', 'obj', '2', '{"test":2}'::jsonb)`, [orgTest6]);
    await client.query(`SELECT ledger_append($1, 'system', 'actor', 'ACT3', null, null, '{"test":3}'::jsonb)`, [orgTest6]);
    const res6 = await client.query(`SELECT seq, encode(prev_hash, 'hex') AS prev_hash, encode(entry_hash, 'hex') AS entry_hash FROM security_ledger WHERE org_id = $1 ORDER BY seq ASC`, [orgTest6]);
    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';
    let broken = false;
    for (const row of res6.rows) {
      if (row.prev_hash !== expectedPrev) {
        broken = true;
        console.error(`❌ Enlace roto en seq ${row.seq}`);
      }
      expectedPrev = row.entry_hash;
    }
    if (!broken && res6.rows.length === 3) {
      console.log('✅ Criterio 6 PASA: 3 eventos insertados y verificados en cadena intacta sin enlaces rotos.');
    } else {
      console.error('❌ Criterio 6 FALLA');
    }

    // Criterio 7: service_role ya no figura con INSERT en information_schema.role_table_grants
    console.log('\n[Criterio 7] Permisos INSERT de service_role sobre security_ledger en role_table_grants...');
    const res7 = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'security_ledger' AND grantee = 'service_role' AND privilege_type = 'INSERT';
    `);
    console.log(`Filas con privilegio INSERT encontradas: ${res7.rows.length}`);
    if (res7.rows.length === 0) {
      console.log('✅ Criterio 7 PASA: service_role ya no figura con INSERT sobre security_ledger.');
    } else {
      console.table(res7.rows);
      console.error('❌ Criterio 7 FALLA');
    }

    // Criterio 8: anon y authenticated ya no figuran con EXECUTE
    console.log('\n[Criterio 8] Permisos EXECUTE de anon y authenticated en routine_privileges...');
    const res8 = await client.query(`
      SELECT grantee, routine_name, privilege_type 
      FROM information_schema.routine_privileges 
      WHERE routine_name IN ('canonical_json', 'jsonb_has_float', 'abort_ledger_modification') 
        AND grantee IN ('anon', 'authenticated', 'public')
      ORDER BY routine_name, grantee;
    `);
    console.log(`Filas encontradas (debería ser 0): ${res8.rows.length}`);
    if (res8.rows.length === 0) {
      console.log('✅ Criterio 8 PASA: Funciones auxiliares sin acceso para anon, authenticated o public.');
    } else {
      console.table(res8.rows);
      console.error('❌ Criterio 8 FALLA');
    }

    // Criterio 9: rechazo de 3.14 y 1e100 en jsonb_has_float
    console.log('\n[Criterio 9] Validación de 3.14 y 1e100 con jsonb_has_float...');
    const res9 = await client.query(`
      SELECT jsonb_has_float('{"v": 3.14}'::jsonb) as rej_float,
             jsonb_has_float('{"v": 1e100}'::jsonb) as rej_exp;
    `);
    console.log('Resultado de jsonb_has_float:', res9.rows[0]);
    if (res9.rows[0].rej_float === true && res9.rows[0].rej_exp === true) {
      console.log('✅ Criterio 9 PASA: Rechaza correctamente 3.14 y 1e100.');
    } else {
      console.error('❌ Criterio 9 FALLA');
    }

    // Criterio 10: aceptación de entero normal, por ejemplo 42
    console.log('\n[Criterio 10] Validación de entero normal 42 con jsonb_has_float...');
    const res10 = await client.query(`
      SELECT jsonb_has_float('{"v": 42, "limit": 9007199254740991}'::jsonb) as rej_int;
    `);
    console.log('Resultado de jsonb_has_float para 42 y MAX_SAFE_INTEGER:', res10.rows[0]);
    if (res10.rows[0].rej_int === false) {
      console.log('✅ Criterio 10 PASA: Acepta correctamente enteros en rango seguro.');
    } else {
      console.error('❌ Criterio 10 FALLA');
    }

  } finally {
    await client.end();
  }
}

verifyAll().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
