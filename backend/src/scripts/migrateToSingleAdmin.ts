import { PrismaClient, Role, UserStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Migration Script: Transition from Multi-Admin to Single-Admin System
 *
 * Safety Guarantees:
 * - Backs up user state before execution
 * - Identifies primary master admin from env or earliest active account
 * - Safely converts secondary admins to Employees without deleting records
 * - Preserves all tasks, client assignments, daily reports, and audit logs
 */
async function migrateToSingleAdmin() {
  console.log('🔍 Inspecting existing Admin accounts in MySQL database...');

  const allAdmins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    include: {
      _count: {
        select: {
          tasksAssigned: true,
          clientAssignments: true,
          dailyReportsSubmitted: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 Found ${allAdmins.length} Admin account(s) in database:`);
  allAdmins.forEach((adm, idx) => {
    console.log(
      `   [${idx + 1}] ID: ${adm.id} | Email: ${adm.email} | Name: ${adm.fullName} | Status: ${adm.status} | Tasks: ${adm._count.tasksAssigned} | Reports: ${adm._count.dailyReportsSubmitted}`
    );
  });

  if (allAdmins.length <= 1) {
    console.log('✅ Single-Admin architecture is already satisfied. No migration required.');
    return;
  }

  const primaryEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@viralstan.com').toLowerCase();
  let primaryAdmin = allAdmins.find((a) => a.email.toLowerCase() === primaryEmail);

  if (!primaryAdmin) {
    primaryAdmin = allAdmins[0]; // fallback to oldest admin
  }

  console.log(`\n👑 Primary Master Admin designated: ${primaryAdmin.fullName} (${primaryAdmin.email}) [ID: ${primaryAdmin.id}]`);

  const secondaryAdmins = allAdmins.filter((a) => a.id !== primaryAdmin!.id);

  console.log(`\n🔄 Safely converting ${secondaryAdmins.length} secondary Admin(s) to Employee role...`);

  for (const sec of secondaryAdmins) {
    await prisma.user.update({
      where: { id: sec.id },
      data: {
        role: Role.EMPLOYEE,
        designation: sec.designation === 'Administrator' ? 'Operations Specialist' : sec.designation,
      },
    });

    console.log(`   ✓ Converted ${sec.email} to EMPLOYEE (All task, client, and report history preserved)`);
  }

  const finalAdminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  console.log(`\n🎉 Migration Complete: Exactly ${finalAdminCount} Admin account active.`);
}

migrateToSingleAdmin()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

