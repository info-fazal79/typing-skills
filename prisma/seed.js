const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminEmail = 'admin@typinginstitute.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('adminpassword', 10);
    const admin = await prisma.user.create({
      data: {
        name: 'Institute Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        status: 'APPROVED',
        points: 0,
      },
    });
    console.log(`Created admin account: ${admin.email}`);
  } else {
    console.log('Admin account already exists.');
  }

  // Create default batch targets
  const defaultBatches = [
    { batchName: 'Batch-A', dailyTargetMinutes: 5, pointsDeduction: 10 },
    { batchName: 'Batch-B', dailyTargetMinutes: 10, pointsDeduction: 15 },
    { batchName: 'Batch-2026-A', dailyTargetMinutes: 5, pointsDeduction: 10 },
  ];

  for (const b of defaultBatches) {
    await prisma.batchTarget.upsert({
      where: { batchName: b.batchName },
      update: {},
      create: {
        batchName: b.batchName,
        dailyTargetMinutes: b.dailyTargetMinutes,
        pointsDeduction: b.pointsDeduction,
      },
    });
  }

  console.log('Database seeding completed.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
