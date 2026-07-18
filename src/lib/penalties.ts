import { prisma } from './db';

/**
 * Checks and applies daily inactivity penalties for a student retrospectively.
 * Runs on user actions (login, dashboard load, saving practice session).
 */
export async function applyInactivityPenalties(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'STUDENT' || user.status !== 'APPROVED') {
      return;
    }

    // Get batch target configuration
    let targetMinutes = 5;
    let penaltyPoints = 10;

    if (user.batchName) {
      const batchTarget = await prisma.batchTarget.findUnique({
        where: { batchName: user.batchName },
      });
      if (batchTarget) {
        targetMinutes = batchTarget.dailyTargetMinutes;
        penaltyPoints = batchTarget.pointsDeduction;
      }
    }

    const targetSeconds = targetMinutes * 60;
    const now = new Date();
    
    // We check penalties from the last check date up to yesterday.
    // The check date starts from the user's lastPenaltyCheck.
    const startCheckDate = new Date(user.lastPenaltyCheck);
    
    // Set to midnight of that check date
    startCheckDate.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    if (startCheckDate >= yesterday) {
      // Already checked up to yesterday or later
      return;
    }

    let currentDate = new Date(startCheckDate);
    let totalDeductions = 0;
    const logsToCreate = [];

    // Loop through each calendar day from startCheckDate to yesterday
    while (currentDate <= yesterday) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // 1. Check if penalty log already exists for this date
      const existingLog = await prisma.userInactivityLog.findUnique({
        where: {
          userId_date: {
            userId: user.id,
            date: dateStr,
          },
        },
      });

      if (!existingLog) {
        // 2. Calculate practice duration for this day
        const dayStart = new Date(`${dateStr}T00:00:00`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999`);

        const sessions = await prisma.practiceSession.findMany({
          where: {
            userId: user.id,
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          select: { duration: true },
        });

        const totalPracticeSeconds = sessions.reduce((sum, s) => sum + s.duration, 0);

        // 3. Apply penalty if target is not met
        if (totalPracticeSeconds < targetSeconds) {
          totalDeductions += penaltyPoints;
          logsToCreate.push({
            userId: user.id,
            date: dateStr,
            pointsDeducted: penaltyPoints,
          });
        } else {
          // Log a 0-deduction activity entry to mark this day as completed/checked
          logsToCreate.push({
            userId: user.id,
            date: dateStr,
            pointsDeducted: 0,
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Apply updates in a transaction
    if (logsToCreate.length > 0) {
      await prisma.$transaction([
        ...logsToCreate.map((log) =>
          prisma.userInactivityLog.create({
            data: log,
          })
        ),
        prisma.user.update({
          where: { id: user.id },
          data: {
            points: Math.max(0, user.points - totalDeductions),
            lastPenaltyCheck: now,
          },
        }),
      ]);
      console.log(`Applied inactivity penalty check for user ${user.email}. Deducted: ${totalDeductions} points.`);
    } else {
      // Just update check timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastPenaltyCheck: now },
      });
    }
  } catch (error) {
    console.error('Error applying inactivity penalties:', error);
  }
}
