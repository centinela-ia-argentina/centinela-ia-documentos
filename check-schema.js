require('dotenv').config({ path: '.env.local' });

async function inspectSchema() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url.endsWith('/rest/v1/')) {
    url = url.slice(0, -9);
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function checkTable(table, columns) {
    console.log(`\nChecking ${table}...`);
    try {
      const res = await fetch(`${url}/rest/v1/${table}?limit=1`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (!res.ok) {
        const err = await res.text();
        console.log(`${table} error:`, res.status, err);
      } else {
        const data = await res.json();
        if (data.length > 0) {
          const cols = Object.keys(data[0]);
          console.log(`Columns found in ${table}:`, cols);
          columns.forEach(c => {
            if (!cols.includes(c)) {
              console.log(`WARNING: Column ${c} is MISSING in ${table}!`);
            } else {
              console.log(`OK: Column ${c} exists in ${table}.`);
            }
          });
        } else {
          console.log(`Table ${table} is empty. Can't reliably infer columns via REST without OpenAPI. Let's try inserting a dummy with invalid column to test.`);
          const testRes = await fetch(`${url}/rest/v1/${table}?limit=1&select=${columns.join(',')}`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
          });
          if (!testRes.ok) {
            console.log(`Error selecting columns:`, await testRes.text());
          } else {
            console.log(`All columns ${columns.join(',')} exist in ${table} (query succeeded).`);
          }
        }
      }
    } catch (e) {
      console.log(`Fetch failed for ${table}:`, e.message);
    }
  }

  await checkTable('checklist_items', ['notes', 'organization_id']);
  await checkTable('agenda_plazos', ['detalle', 'hora']);
  
  console.log(`\nChecking function match_case_document_chunks...`);
  try {
    const res = await fetch(`${url}/rest/v1/rpc/match_case_document_chunks`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        case_id: '00000000-0000-0000-0000-000000000000',
        query_embedding: new Array(1536).fill(0),
        match_threshold: 0.5,
        match_count: 5
      })
    });
    if (!res.ok) {
      console.log(`Function error:`, res.status, await res.text());
    } else {
      console.log(`Function exists and executed (or returned empty)!`);
    }
  } catch(e) {
    console.log(`Function fetch failed:`, e.message);
  }
}

inspectSchema();
