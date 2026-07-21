const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Runs each collection migration independently and reports a source-count vs
// migrated-count summary at the end, so a failure in one collection can never
// silently skip the others or be mistaken for a clean run. Exits with a
// non-zero status if anything failed, so it's safe to script/CI this.
async function migrateCollection(name, run) {
  try {
    const { sourceCount, migratedCount } = await run();
    const ok = migratedCount === sourceCount;
    console.log(
      `${ok ? '✓' : '⚠'} ${name}: ${migratedCount}/${sourceCount} migrated${ok ? '' : ' — COUNT MISMATCH, check manually'}`
    );
    return { name, ok: true, sourceCount, migratedCount };
  } catch (error) {
    console.error(`✗ ${name}: FAILED —`, error.message || error);
    return { name, ok: false, error };
  }
}

async function migrate() {
  console.log('Starting migration...');

  // 1. Initialize Firebase Admin
  let serviceAccount;
  const keyPath = path.join(__dirname, '../firebase-key.json');
  if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } else {
    throw new Error('No FIREBASE_SERVICE_ACCOUNT found');
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // 2. Initialize Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase keys in environment variables');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Connected to Firebase and Supabase.');

  const results = [];

  // ---------------------------------------------------------
  // Migrate Users
  // ---------------------------------------------------------
  results.push(await migrateCollection('users', async () => {
    const usersSnap = await db.collection('users').get();
    // Firestore doc IDs are 20-char strings, not UUIDs — the Supabase `users.id`
    // column must be TEXT (not uuid) for this direct ID carry-over to work.
    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        email: (data.email || '').toLowerCase(),
        password_hash: data.passwordHash || '',
        role: data.role || 'USER',
        status: data.status || 'PENDING',
        course_name: data.courseName || null,
        batch_name: data.batchName || null,
        roll_number: data.rollNumber || null,
        points: data.points || 0,
        best_wpm: data.bestWpm || 0,
        avg_wpm: data.avgWpm || 0,
        total_wpm_sum: data.totalWpmSum || 0,
        session_count: data.sessionCount || 0,
        last_penalty_check: data.lastPenaltyCheck ? data.lastPenaltyCheck.toDate().toISOString() : new Date().toISOString(),
        created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updated_at: data.updatedAt ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
      };
    });

    const { error } = await supabase.from('users').upsert(users);
    if (error) throw error;
    return { sourceCount: users.length, migratedCount: users.length };
  }));

  // ---------------------------------------------------------
  // Migrate Practice Sessions
  // ---------------------------------------------------------
  results.push(await migrateCollection('practice_sessions', async () => {
    const sessionsSnap = await db.collection('practice_sessions').get();
    const sessions = sessionsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        user_id: data.userId,
        wpm: data.wpm || 0,
        accuracy: data.accuracy || 0,
        duration: data.duration || 0,
        language: data.language || 'ENGLISH',
        mode: data.mode || 'Standard',
        points_earned: data.pointsEarned || 0,
        created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });

    for (let i = 0; i < sessions.length; i += 1000) {
      const chunk = sessions.slice(i, i + 1000);
      const { error } = await supabase.from('practice_sessions').upsert(chunk);
      if (error) throw error;
    }
    return { sourceCount: sessions.length, migratedCount: sessions.length };
  }));

  // ---------------------------------------------------------
  // Migrate Metadata
  // ---------------------------------------------------------
  results.push(await migrateCollection('metadata', async () => {
    const metaSnap = await db.collection('metadata').doc('selectors').get();
    if (!metaSnap.exists) return { sourceCount: 0, migratedCount: 0 };

    const d = metaSnap.data();
    const { error } = await supabase.from('metadata').upsert({
      id: 'selectors',
      courses_json: d.courses || {},
      roll_numbers_json: d.rollNumbersByBatch || {}
    });
    if (error) throw error;
    return { sourceCount: 1, migratedCount: 1 };
  }));

  // ---------------------------------------------------------
  // Migrate Batch Targets
  // ---------------------------------------------------------
  results.push(await migrateCollection('batch_targets', async () => {
    const targetsSnap = await db.collection('batch_targets').get();
    if (targetsSnap.empty) return { sourceCount: 0, migratedCount: 0 };

    const targets = targetsSnap.docs.map(doc => ({
      batch_name: doc.id,
      daily_target_minutes: doc.data().dailyTargetMinutes || 5,
      points_deduction: doc.data().pointsDeduction || 10
    }));
    const { error } = await supabase.from('batch_targets').upsert(targets);
    if (error) throw error;
    return { sourceCount: targets.length, migratedCount: targets.length };
  }));

  // ---------------------------------------------------------
  // Migrate Tasks
  // ---------------------------------------------------------
  results.push(await migrateCollection('tasks', async () => {
    const tasksSnap = await db.collection('tasks').get();
    if (tasksSnap.empty) return { sourceCount: 0, migratedCount: 0 };

    const tasks = tasksSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title,
        text_content: d.textContent,
        language: d.language,
        target_wpm: d.targetWpm,
        target_accuracy: d.targetAccuracy,
        deadline: d.deadline ? new Date(d.deadline).toISOString() : new Date().toISOString(),
        points_awardable: d.pointsAwardable,
        batches: d.batches || [],
        completions_count: d.completionsCount || 0,
        created_at: d.createdAt ? d.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });
    const { error } = await supabase.from('tasks').upsert(tasks);
    if (error) throw error;
    return { sourceCount: tasks.length, migratedCount: tasks.length };
  }));

  // ---------------------------------------------------------
  // Migrate Task Submissions
  // ---------------------------------------------------------
  results.push(await migrateCollection('task_submissions', async () => {
    const subsSnap = await db.collection('task_submissions').get();
    if (subsSnap.empty) return { sourceCount: 0, migratedCount: 0 };

    const subs = subsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        task_id: d.taskId,
        user_id: d.userId,
        wpm: d.wpm,
        accuracy: d.accuracy,
        // These two were previously dropped during migration — they exist on
        // both the Firestore documents and the Supabase table (see
        // src/app/api/tasks/submit/route.ts), so omitting them silently lost
        // every already-migrated submission's points/lateness status.
        points_earned: d.pointsEarned || 0,
        is_late: d.isLate || false,
        created_at: d.createdAt ? d.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });
    const { error } = await supabase.from('task_submissions').upsert(subs);
    if (error) throw error;
    return { sourceCount: subs.length, migratedCount: subs.length };
  }));

  console.log('\n--- Migration summary ---');
  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    console.log(r.ok ? `  ${r.name}: OK (${r.migratedCount}/${r.sourceCount})` : `  ${r.name}: FAILED`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} collection(s) failed to migrate. Fix the errors above and re-run — upserts are idempotent, so already-migrated collections are safe to repeat.`);
    process.exitCode = 1;
  } else {
    console.log('\nMigration completed successfully!');
  }
}

migrate().catch(error => {
  console.error('Migration script crashed before completing:', error);
  process.exitCode = 1;
});
