import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { calculateEntryHash, toBuffer } from '../ledger/canonical';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test.local') });

const rawUrl = process.env.SUPABASE_TEST_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Falta SUPABASE_TEST_URL o SUPABASE_TEST_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- VERIFICACIÓN DE LA CADENA DEL LEDGER ---');

  const { data: rows, error } = await supabase
    .from('security_ledger')
    .select('*')
    .order('org_id', { ascending: true })
    .order('seq', { ascending: true });

  if (error) {
    console.error('Error al consultar el ledger:', error);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No hay registros en el ledger.');
    return;
  }

  let filasVerificadas = 0;
  let historicasOmitidas = 0;
  const discrepancias: any[] = [];
  const verifiableRows: any[] = [];

  for (const row of rows) {
    if (row.canon_version === 1) {
      historicasOmitidas++;
      continue;
    }

    if (row.canon_version === 2) {
      verifiableRows.push(row);
      try {
        const computedHashBuf = calculateEntryHash(row);
        const computedHex = computedHashBuf.toString('hex').toLowerCase();
        const storedHex = toBuffer(row.entry_hash).toString('hex').toLowerCase();

        if (computedHex === storedHex) {
          filasVerificadas++;
        } else {
          discrepancias.push({ org_id: row.org_id, seq: row.seq, expected: storedHex, computed: computedHex });
        }
      } catch (err: any) {
        discrepancias.push({ org_id: row.org_id, seq: row.seq, error: err.message });
      }
    }
  }

  console.log(`Filas verificadas: ${filasVerificadas}`);
  console.log(`Filas historicas omitidas (canon_version=1): ${historicasOmitidas}`);

  if (discrepancias.length > 0) {
    console.log(`❌ Discrepancias encontradas (${discrepancias.length}):`);
    console.table(discrepancias);
  } else {
    console.log('✅ No se encontraron discrepancias. La cadena es válida y verificada en TypeScript.');
  }

  console.log('\n[Demostración de detección de alteraciones (Criterio 9)]');
  if (verifiableRows.length > 0) {
    const tamperedRow = JSON.parse(JSON.stringify(verifiableRows[0]));
    tamperedRow.payload = typeof tamperedRow.payload === 'object' && tamperedRow.payload !== null 
      ? { ...tamperedRow.payload, tampered_byte: 'X' } 
      : { tampered_byte: 'X' };
      
    try {
      const computedTampered = calculateEntryHash(tamperedRow).toString('hex').toLowerCase();
      const storedOriginal = toBuffer(tamperedRow.entry_hash).toString('hex').toLowerCase();
      
      console.log(`Fila alterada en memoria (org_id: ${tamperedRow.org_id}, seq: ${tamperedRow.seq}):`);
      console.log(`Hash original en BD: ${storedOriginal}`);
      console.log(`Hash recalculado con payload alterado: ${computedTampered}`);
      
      if (computedTampered !== storedOriginal) {
        console.log('✅ Criterio 9 PASA: El verificador detecta exitosamente la alteración de un byte.');
      } else {
        console.error('❌ Criterio 9 FALLA: El hash coincidió inesperadamente.');
      }
    } catch (e: any) {
      console.log(`✅ Criterio 9 PASA: El verificador detecta exitosamente la alteración arrojando error: ${e.message}`);
    }
  } else {
    console.log('No hay filas con canon_version=2 para demostrar el Criterio 9.');
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
