/**
 * sync-remaining-data.js
 * 
 * Syncs remaining data from Firestore to Supabase:
 *   1. Metadata (courses, batches, roll numbers) → 'metadata' table
 *   2. Batch targets → 'batch_targets' table
 *   3. Tasks → 'tasks' table
 *   4. Task submissions → 'task_submissions' table
 *   5. Practice sessions → 'practice_sessions' table
 *
 * SAFE: Does NOT touch or recreate existing users.
 * Uses upsert to avoid duplicates if run multiple times.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIso(val) {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function upsertInChunks(supabase, table, rows, chunkSize = 500) {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ Error upserting chunk into "${table}":`, error.message);
      throw error;
    }
    total += chunk.length;
    process.stdout.write(`\r  ↳ Inserted ${total}/${rows.length} rows into "${table}"...`);
  }
  console.log(`\r  ✓ ${rows.length} rows synced into "${table}"               `);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function sync() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Firestore → Supabase  Remaining Data Sync     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Initialize Firebase Admin
  let serviceAccount;
  const keyPath = path.join(__dirname, '../firebase-key.json');
  if (fs.existsSync(keyPath)) {
    console.log('Using firebase-key.json');
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Using FIREBASE_SERVICE_ACCOUNT env var');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } else {
    throw new Error('No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or provide firebase-key.json');
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log('✓ Firebase Admin initialized');

  // 2. Initialize Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  console.log('✓ Supabase client initialized\n');

  // ── Step 1: Sync Metadata (courses, batches, roll numbers) ─────────────────
  console.log('【Step 1】Syncing metadata (courses / batches / roll numbers)...');
  const metaSnap = await db.collection('metadata').doc('selectors').get();
  if (metaSnap.exists) {
    const d = metaSnap.data();
    const { error } = await supabase.from('metadata').upsert({
      id: 'selectors',
      courses_json: d.courses || {},
      roll_numbers_json: d.rollNumbersByBatch || {}
    });
    if (error) {
      console.error('  ✗ Metadata sync failed:', error.message);
    } else {
      const courseCount = Object.keys(d.courses || {}).length;
      const batchCount = Object.values(d.courses || {}).flat().length;
      const rollCount = Object.values(d.rollNumbersByBatch || {}).flat().length;
      console.log(`  ✓ Metadata synced: ${courseCount} courses, ${batchCount} batches, ${rollCount} roll numbers`);
    }
  } else {
    console.log('  ⚠ No metadata/selectors document found in Firestore — skipping');
  }

  // ── Step 2: Sync Batch Targets ──────────────────────────────────────────────
  console.log('\n【Step 2】Syncing batch targets...');
  const targetsSnap = await db.collection('batch_targets').get();
  if (!targetsSnap.empty) {
    const targets = targetsSnap.docs.map(doc => ({
      batch_name: doc.id,
      daily_target_minutes: doc.data().dailyTargetMinutes || 5,
      points_deduction: doc.data().pointsDeduction || 10
    }));
    const { error } = await supabase.from('batch_targets').upsert(targets, { onConflict: 'batch_name' });
    if (error) {
      console.error('  ✗ Batch targets sync failed:', error.message);
    } else {
      console.log(`  ✓ ${targets.length} batch target(s) synced`);
    }
  } else {
    console.log('  ⚠ No batch_targets found in Firestore — skipping');
  }

  // ── Step 3: Sync Tasks ──────────────────────────────────────────────────────
  console.log('\n【Step 3】Syncing tasks...');
  const tasksSnap = await db.collection('tasks').get();
  if (!tasksSnap.empty) {
    const tasks = tasksSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || '(untitled)',
        text_content: d.textContent || '',
        language: d.language || 'ENGLISH',
        target_wpm: Number(d.targetWpm) || 40,
        target_accuracy: Number(d.targetAccuracy) || 90,
        deadline: toIso(d.deadline),
        points_awardable: Number(d.pointsAwardable) || 100,
        batches: Array.isArray(d.batches) ? d.batches : [],
        completions_count: Number(d.completionsCount) || 0,
        created_at: toIso(d.createdAt)
      };
    });
    await upsertInChunks(supabase, 'tasks', tasks);
  } else {
    console.log('  ⚠ No tasks found in Firestore — skipping');
  }

  // ── Step 4: Sync Task Submissions ──────────────────────────────────────────
  console.log('\n【Step 4】Syncing task submissions...');

  // Fetch valid task IDs from Supabase
  const { data: supabaseTasks } = await supabase.from('tasks').select('id');
  const validTaskIds = new Set((supabaseTasks || []).map(t => t.id));

  // Fetch valid user IDs from Supabase (needed here too before Step 5)
  console.log('  Fetching existing user IDs from Supabase for validation...');
  const { data: supabaseUsersEarly, error: earlyUserErr } = await supabase.from('users').select('id');
  if (earlyUserErr) throw earlyUserErr;
  const validUserIdsEarly = new Set(supabaseUsersEarly.map(u => u.id));
  console.log(`  ✓ Found ${validUserIdsEarly.size} users and ${validTaskIds.size} tasks in Supabase`);

  const subsSnap = await db.collection('task_submissions').get();
  if (!subsSnap.empty) {
    let skippedSubs = 0;
    const subs = [];
    subsSnap.docs.forEach(doc => {
      const d = doc.data();
      const userId = d.userId || '';
      const taskId = d.taskId || '';
      // Only insert if both user and task exist in Supabase
      if (!validUserIdsEarly.has(userId) || !validTaskIds.has(taskId)) {
        skippedSubs++;
        return;
      }
      subs.push({
        id: doc.id,
        task_id: taskId,
        user_id: userId,
        wpm: Number(d.wpm) || 0,
        accuracy: Number(d.accuracy) || 0,
        created_at: toIso(d.createdAt)
      });
    });
    if (skippedSubs > 0) {
      console.log(`  ⚠ Skipped ${skippedSubs} submissions with no matching user/task in Supabase`);
    }
    if (subs.length > 0) {
      await upsertInChunks(supabase, 'task_submissions', subs);
    } else {
      console.log('  ⚠ No valid task submissions to insert');
    }
  } else {
    console.log('  ⚠ No task_submissions found in Firestore — skipping');
  }

  // ── Step 5: Fetch existing Supabase user IDs for validation ────────────────
  console.log('\n【Step 5】Syncing practice sessions...');
  // Reuse validUserIdsEarly from Step 4
  const validUserIds = validUserIdsEarly;

  // Fetch practice sessions from Firestore
  console.log('  Fetching practice sessions from Firestore...');
  const sessionsSnap = await db.collection('practice_sessions').get();
  console.log(`  Found ${sessionsSnap.size} sessions in Firestore`);

  if (!sessionsSnap.empty) {
    let skipped = 0;
    const sessions = [];

    sessionsSnap.docs.forEach(doc => {
      const d = doc.data();
      const userId = d.userId || '';

      // Only include sessions where the user exists in Supabase
      if (!validUserIds.has(userId)) {
        skipped++;
        return;
      }

      sessions.push({
        id: doc.id,
        user_id: userId,
        wpm: Number(d.wpm) || 0,
        accuracy: Number(d.accuracy) || 0,
        duration: Number(d.duration) || 0,
        language: d.language || 'ENGLISH',
        mode: d.mode || 'Standard',
        points_earned: Number(d.pointsEarned) || 0,
        created_at: toIso(d.createdAt)
      });
    });

    if (skipped > 0) {
      console.log(`  ⚠ Skipped ${skipped} sessions with no matching user in Supabase`);
    }

    if (sessions.length > 0) {
      await upsertInChunks(supabase, 'practice_sessions', sessions, 500);
    } else {
      console.log('  ⚠ No valid sessions to insert');
    }
  } else {
    console.log('  ⚠ No practice_sessions found in Firestore — skipping');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   ✅  Sync completed successfully!               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
}

sync().catch(err => {
  console.error('\n✗ Sync failed with error:', err.message || err);
  process.exit(1);
});
