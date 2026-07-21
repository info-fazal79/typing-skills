/**
 * scripts/run-sql.js
 * Run raw SQL against Supabase using the management API
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const projectRef = 'jkkfmmzibbklcapcjlyc'; // extracted from supabase URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_slug_unique ON users (slug) WHERE slug IS NOT NULL;`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: `${projectRef}.supabase.co`,
  port: 443,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(body);
req.end();
