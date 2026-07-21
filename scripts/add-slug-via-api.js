/**
 * scripts/add-slug-via-api.js
 * Uses Supabase's pg meta API (available via project management)
 * to add the slug column
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const projectRef = 'jkkfmmzibbklcapcjlyc';
// Use the pg meta API which is part of Supabase's internal tooling
// Accessible at https://<ref>.supabase.co/pg/query

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeRequest(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(bodyStr),
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Try Supabase's built-in SQL endpoint
  const endpoints = [
    { host: `${projectRef}.supabase.co`, path: '/pg/query' },
    { host: `api.supabase.com`, path: `/v1/projects/${projectRef}/database/query` },
  ];

  const sql = 'ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT;';

  for (const ep of endpoints) {
    const result = await makeRequest(ep.host, ep.path, { query: sql });
    console.log(`${ep.host}${ep.path} → ${result.status}: ${result.body.substring(0, 200)}`);
    if (result.status === 200 || result.status === 201) {
      console.log('✓ Success!');
      return;
    }
  }
  console.log('\nDirect API approach not available. The slug column needs to be added manually in the Supabase SQL Editor.');
}

main().catch(console.error);
