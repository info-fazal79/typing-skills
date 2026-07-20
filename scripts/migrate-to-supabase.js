const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

  try {
    // ---------------------------------------------------------
    // Migrate Users
    // ---------------------------------------------------------
    console.log('Fetching users from Firestore...');
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        // use generated UUID if we can't map string IDs, but we can store string IDs in UUID if they are valid.
        // Wait, Firestore IDs are 20 char strings. Supabase id is UUID.
        // We MUST map the old ID to the new UUID, or change Supabase schema to use TEXT for id!
        // To keep relations simple, let's keep the existing ID by using TEXT for the Supabase id column.
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

    console.log(`Inserting ${users.length} users into Supabase...`);
    const { error: userErr } = await supabase.from('users').upsert(users);
    if (userErr) throw userErr;
    console.log('Users migrated successfully.');

    // ---------------------------------------------------------
    // Migrate Practice Sessions
    // ---------------------------------------------------------
    console.log('Fetching practice sessions from Firestore...');
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

    console.log(`Inserting ${sessions.length} practice sessions...`);
    // Insert in batches of 1000
    for (let i = 0; i < sessions.length; i += 1000) {
      const chunk = sessions.slice(i, i + 1000);
      const { error: sessionErr } = await supabase.from('practice_sessions').upsert(chunk);
      if (sessionErr) throw sessionErr;
    }
    console.log('Practice sessions migrated successfully.');

    // ---------------------------------------------------------
    // Migrate Metadata & Targets
    // ---------------------------------------------------------
    console.log('Migrating metadata...');
    const metaSnap = await db.collection('metadata').doc('selectors').get();
    if (metaSnap.exists) {
      const d = metaSnap.data();
      const { error: metaErr } = await supabase.from('metadata').upsert({
        id: 'selectors',
        courses_json: d.courses || {},
        roll_numbers_json: d.rollNumbersByBatch || {}
      });
      if (metaErr) throw metaErr;
    }

    const targetsSnap = await db.collection('batch_targets').get();
    if (!targetsSnap.empty) {
      const targets = targetsSnap.docs.map(doc => ({
        batch_name: doc.id,
        daily_target_minutes: doc.data().dailyTargetMinutes || 5,
        points_deduction: doc.data().pointsDeduction || 10
      }));
      const { error: targetErr } = await supabase.from('batch_targets').upsert(targets);
      if (targetErr) throw targetErr;
    }

    // ---------------------------------------------------------
    // Migrate Tasks
    // ---------------------------------------------------------
    console.log('Migrating tasks...');
    const tasksSnap = await db.collection('tasks').get();
    if (!tasksSnap.empty) {
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
      const { error: taskErr } = await supabase.from('tasks').upsert(tasks);
      if (taskErr) throw taskErr;
    }

    // ---------------------------------------------------------
    // Migrate Task Submissions
    // ---------------------------------------------------------
    const subsSnap = await db.collection('task_submissions').get();
    if (!subsSnap.empty) {
      const subs = subsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          task_id: d.taskId,
          user_id: d.userId,
          wpm: d.wpm,
          accuracy: d.accuracy,
          created_at: d.createdAt ? d.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
      const { error: subErr } = await supabase.from('task_submissions').upsert(subs);
      if (subErr) throw subErr;
    }

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
