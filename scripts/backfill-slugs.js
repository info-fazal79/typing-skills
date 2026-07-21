/**
 * scripts/backfill-slugs.js
 *
 * One-time script to:
 *  1. Add slug column to users table (if not exists — done via SQL separately)
 *  2. Generate slugs for all existing users who don't have one
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')      // remove non-word chars (keep hyphens)
    .replace(/[\s_]+/g, '-')       // spaces/underscores → hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // trim leading/trailing hyphens
}

async function backfill() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env vars');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  console.log('Fetching all users...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, slug, roll_number');

  if (error) throw error;
  console.log(`Found ${users.length} users`);

  let updated = 0;
  let skipped = 0;

  // Collect all slugs we'll assign to detect duplicates
  const assignedSlugs = new Set(
    users.filter(u => u.slug).map(u => u.slug)
  );

  for (const user of users) {
    if (user.slug) {
      skipped++;
      continue;
    }

    let baseSlug = generateSlug(user.name || 'user');
    if (!baseSlug) baseSlug = 'user';

    let slug = baseSlug;
    // If slug already taken, append roll number or random 3-digit suffix
    if (assignedSlugs.has(slug)) {
      if (user.roll_number) {
        slug = `${baseSlug}-${user.roll_number.toLowerCase().replace(/\s+/g, '-')}`;
      }
      // Still taken? Append random suffix
      if (assignedSlugs.has(slug)) {
        slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }

    assignedSlugs.add(slug);

    const { error: updateErr } = await supabase
      .from('users')
      .update({ slug })
      .eq('id', user.id);

    if (updateErr) {
      console.error(`  ✗ Failed to update ${user.name}: ${updateErr.message}`);
    } else {
      updated++;
      process.stdout.write(`\r  Updated ${updated} users...`);
    }
  }

  console.log(`\n✓ Done. Updated: ${updated}, Already had slug: ${skipped}`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
