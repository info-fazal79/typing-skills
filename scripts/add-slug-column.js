/**
 * scripts/add-slug-column.js
 * Adds `slug` column to the users table via Supabase REST API using raw SQL
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use Supabase's pg_dump/raw SQL via the management API isn't available on free tier.
// Instead, use the Supabase JS client to run a raw query via rpc if available,
// or just insert a dummy user to test - actually we use the pg REST directly.

// The simplest approach: attempt an update that will fail gracefully if column doesn't exist,
// and use the Supabase client's .rpc() for raw SQL if available.
// Since the free tier doesn't expose pg functions by default, we'll use a workaround:
// Try to select the slug column - if it errors, we know it needs adding.

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Test if slug column exists by trying to select it
  const { error } = await supabase
    .from('users')
    .select('slug')
    .limit(1);

  if (!error) {
    console.log('✓ slug column already exists');
    return;
  }

  if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
    console.log('slug column missing. Please run the following SQL in your Supabase SQL Editor:');
    console.log('\n  ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;\n');
    console.log('Then re-run: node scripts/backfill-slugs.js');
    process.exit(1);
  } else {
    console.log('Error checking slug column:', error.message);
    process.exit(1);
  }
}

main();
