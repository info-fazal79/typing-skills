import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Checks and applies daily inactivity penalties for a student retrospectively.
 * Runs on user actions (login, dashboard load, saving practice session).
 */
export async function applyInactivityPenalties(userId: string) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const user = userDoc.data()!;
    if (user.role !== 'STUDENT' || user.status !== 'APPROVED') return;

    // Get batch target configuration
    let targetMinutes = 5;
    let penaltyPoints = 10;

    if (user.batchName) {
      const batchDoc = await db.collection('batch_targets').doc(user.batchName).get();
      if (batchDoc.exists) {
        const batchTarget = batchDoc.data()!;
        targetMinutes = batchTarget.dailyTargetMinutes ?? 5;
        penaltyPoints = batchTarget.pointsDeduction ?? 10;
      }
    }

    const targetSeconds = targetMinutes * 60;
    const now = new Date();

    // Start from lastPenaltyCheck, check up to yesterday
    const lastCheck = user.lastPenaltyCheck?.toDate
      ? user.lastPenaltyCheck.toDate()
      : new Date(user.lastPenaltyCheck || user.createdAt?.toDate?.() || now);

    const startCheckDate = new Date(lastCheck);
    startCheckDate.setHours(0, 0, 0, 0);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    if (startCheckDate >= yesterday) return;

    let currentDate = new Date(startCheckDate);
    let totalDeductions = 0;
    const logsToCreate: { id: string; data: object }[] = [];

    while (currentDate <= yesterday) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const logId = `${userId}_${dateStr}`;

      // Check if penalty log already exists
      const existingLog = await db.collection('inactivity_logs').doc(logId).get();

      if (!existingLog.exists) {
        const dayStart = new Date(`${dateStr}T00:00:00`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999`);

        const sessionsSnap = await db
          .collection('practice_sessions')
          .where('userId', '==', userId)
          .where('createdAt', '>=', dayStart)
          .where('createdAt', '<=', dayEnd)
          .get();

        const totalPracticeSeconds = sessionsSnap.docs.reduce(
          (sum, d) => sum + (d.data().duration ?? 0),
          0
        );

        const pointsDeducted = totalPracticeSeconds < targetSeconds ? penaltyPoints : 0;
        if (pointsDeducted > 0) totalDeductions += pointsDeducted;

        logsToCreate.push({
          id: logId,
          data: {
            userId,
            date: dateStr,
            pointsDeducted,
            createdAt: now,
          },
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Apply updates
    const batch = db.batch();

    for (const log of logsToCreate) {
      batch.set(db.collection('inactivity_logs').doc(log.id), log.data);
    }

    const newPoints = Math.max(0, (user.points ?? 0) - totalDeductions);
    batch.update(db.collection('users').doc(userId), {
      points: newPoints,
      lastPenaltyCheck: now,
    });

    await batch.commit();

    if (totalDeductions > 0) {
      console.log(`Applied inactivity penalty for user ${user.email}. Deducted: ${totalDeductions} points.`);
    }
  } catch (error) {
    console.error('Error applying inactivity penalties:', error);
  }
}
