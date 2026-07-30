import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: '.env.test.local' });

let dbUrl = process.env.SUPABASE_TEST_DB_URL;
if (!dbUrl) throw new Error('Falta SUPABASE_TEST_DB_URL');
dbUrl = dbUrl.replace('[chocolate2026casa]', 'chocolate2026casa');

const ORG_A = 'bbbbbbbb-0000-0000-0000-00000000a001';
const ORGS_B = [
  'bbbbbbbb-0000-0000-0000-00000000b001',
  'bbbbbbbb-0000-0000-0000-00000000b002',
  'bbbbbbbb-0000-0000-0000-00000000b003',
  'bbbbbbbb-0000-0000-0000-00000000b004',
  'bbbbbbbb-0000-0000-0000-00000000b005',
  'bbbbbbbb-0000-0000-0000-00000000b006',
  'bbbbbbbb-0000-0000-0000-00000000b007',
  'bbbbbbbb-0000-0000-0000-00000000b008',
  'bbbbbbbb-0000-0000-0000-00000000b009',
  'bbbbbbbb-0000-0000-0000-00000000b010'
];

async function createClient() {
  const client = new Client({ connectionString: dbUrl });
  try {
      await client.connect();
  } catch (e) {
      const urlEncoded = process.env.SUPABASE_TEST_DB_URL!.replace('[chocolate2026casa]', '%5Bchocolate2026casa%5D');
      const client2 = new Client({ connectionString: urlEncoded });
      await client2.connect();
      return client2;
  }
  return client;
}

async function runTests() {
    // 10 clientes independientes
    const clients = await Promise.all(Array.from({ length: 10 }, () => createClient()));

    const pids: number[] = [];
    for (const client of clients) {
        const res = await client.query('select pg_backend_pid()');
        pids.push(res.rows[0].pg_backend_pid);
    }
    
    const uniquePidsCount = new Set(pids).size;

    const artifactsDir = path.join(__dirname, 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const evidenceData = {
        timestamp: timestamp,
        pids: pids,
        distinctCount: uniquePidsCount,
        scenario: 'concurrency_ledger'
    };
    const evidenceFileName = `evidence_${timestamp.replace(/[:.]/g, '-')}.json`;
    
    fs.writeFileSync(path.join(artifactsDir, evidenceFileName), JSON.stringify(evidenceData, null, 2), 'utf-8');
    
    console.log('--- CRITERIO 1: 10 PIDs DISTINTOS ---');
    console.log(pids.join(', '));

    if (uniquePidsCount < 10) {
        throw new Error(`Concurrencia invalida: se esperaban 10 procesos distintos, se obtuvieron ${uniquePidsCount}`);
    }

    // TAREA 2: Escenario 1
    console.log('--- ESCENARIO 1 ---');
    const startBarrier1 = new Promise<void>((resolve) => setTimeout(resolve, 500));
    
    let errors1: string[] = [];
    const calls1 = clients.map((client, i) => {
        return async () => {
            await startBarrier1;
            for (let j = 0; j < 20; j++) {
                try {
                    const payload = { conn: i, call: j };
                    await client.query(`
                        select ledger_append(
                            $1::uuid,
                            'system',
                            'test_actor',
                            'test_action',
                            'test_object',
                            'test_obj_id',
                            $2::jsonb
                        )
                    `, [ORG_A, JSON.stringify(payload)]);
                } catch (e: any) {
                    errors1.push(e.message);
                }
            }
        };
    });

    await Promise.all(calls1.map(fn => fn()));
    console.log('Errores Escenario 1:', errors1.length);
    if (errors1.length > 0) {
        console.error('Mensajes de error Escenario 1:', errors1);
    }

    // TAREA 3: Escenario 2
    console.log('--- ESCENARIO 2 ---');
    const startBarrier2 = new Promise<void>((resolve) => setTimeout(resolve, 500));
    let errors2: string[] = [];
    
    const calls2 = clients.map((client, i) => {
        return async () => {
            await startBarrier2;
            const orgId = ORGS_B[i];
            for (let j = 0; j < 10; j++) {
                try {
                    const payload = { conn: i, call: j };
                    await client.query(`
                        select ledger_append(
                            $1::uuid,
                            'system',
                            'test_actor',
                            'test_action',
                            'test_object',
                            'test_obj_id',
                            $2::jsonb
                        )
                    `, [orgId, JSON.stringify(payload)]);
                } catch (e: any) {
                    errors2.push(e.message);
                }
            }
        };
    });

    await Promise.all(calls2.map(fn => fn()));
    console.log('Errores Escenario 2:', errors2.length);
    if (errors2.length > 0) {
        console.error('Mensajes de error Escenario 2:', errors2);
    }

    // Validate Escenario 1
    console.log('--- VALIDACION ESCENARIO 1 ---');
    const check1 = await clients[0].query(`
        select 
            count(*) as total_rows,
            min(seq) as min_seq,
            max(seq) as max_seq,
            count(distinct seq) as distinct_seq
        from security_ledger
        where org_id = $1
    `, [ORG_A]);
    console.log('Estadisticas Escenario 1:', check1.rows[0]);
    
    // Check gaps: total_rows should be max - min + 1
    const { total_rows, min_seq, max_seq, distinct_seq } = check1.rows[0];
    const hasGaps = parseInt(total_rows) !== (parseInt(max_seq) - parseInt(min_seq) + 1);
    console.log(`Huecos Escenario 1: ${hasGaps ? 'SI' : 'NO'}`);

    const chain1 = await clients[0].query(`
        select count(*) as ok_links
        from security_ledger curr
        join security_ledger prev on prev.org_id = curr.org_id and prev.seq = curr.seq - 1
        where curr.org_id = $1 and curr.seq > 1 and curr.prev_hash = prev.entry_hash
    `, [ORG_A]);
    const total_curr_rows1 = await clients[0].query(`select count(*) as cnt from security_ledger where org_id = $1 and seq > 1`, [ORG_A]);
    const okLinks1 = parseInt(chain1.rows[0].ok_links);
    const totalCurr1 = parseInt(total_curr_rows1.rows[0].cnt);
    const brokenLinks1 = totalCurr1 - okLinks1;
    console.log(`Enlaces verificados Escenario 1: ${okLinks1}`);
    console.log(`Enlaces rotos Escenario 1: ${brokenLinks1}`);

    // Validate Escenario 2
    console.log('--- VALIDACION ESCENARIO 2 ---');
    let totalErrors2 = 0;
    for (const org of ORGS_B) {
        const check2 = await clients[0].query(`
            select count(*) as total_rows, min(seq) as min_seq, max(seq) as max_seq, count(distinct seq) as distinct_seq
            from security_ledger where org_id = $1
        `, [org]);
        const chain2 = await clients[0].query(`
            select count(*) as ok_links
            from security_ledger curr
            join security_ledger prev on prev.org_id = curr.org_id and prev.seq = curr.seq - 1
            where curr.org_id = $1 and curr.seq > 1 and curr.prev_hash = prev.entry_hash
        `, [org]);
        const totCurr2 = await clients[0].query(`select count(*) as cnt from security_ledger where org_id = $1 and seq > 1`, [org]);
        const broken2 = parseInt(totCurr2.rows[0].cnt) - parseInt(chain2.rows[0].ok_links);
        
        const gaps2 = parseInt(check2.rows[0].total_rows) !== (parseInt(check2.rows[0].max_seq) - parseInt(check2.rows[0].min_seq) + 1);
        if (broken2 > 0 || gaps2 || check2.rows[0].total_rows !== '10' || check2.rows[0].distinct_seq !== '10') {
             totalErrors2++;
             console.log(`Org: ${org} - Filas: ${check2.rows[0].total_rows}, Min seq: ${check2.rows[0].min_seq}, Max: ${check2.rows[0].max_seq}, Dist: ${check2.rows[0].distinct_seq}, Rotos: ${broken2}, Huecos: ${gaps2}`);
        }
    }
    if (totalErrors2 === 0) {
        console.log("Escenario 2: Las 10 organizaciones tienen 10 filas, seq 1 a 10, 0 huecos, 0 rotos.");
    }

    for (const client of clients) {
        await client.end();
    }
}

runTests().catch(console.error);
