import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(pass: string) {
  return bcrypt.hash(pass, 12);
}

/**
 * Clean production seeder:
 * - Bootstraps the first master Admin ONLY if no Admin exists in the database
 * - Services and packages must be explicitly created by the Admin through the UI/API, never auto-seeded
 */
async function main() {
  console.log('🌱 Checking Viralstan CMS Master Admin Setup...');

  const existingAdminCount = await prisma.user.count({
    where: { role: Role.ADMIN },
  });

  if (existingAdminCount === 0) {
    const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@viralstan.com').toLowerCase();
   const adminRawPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!adminRawPassword || adminRawPassword.length < 8) {
  throw new Error(
    'INITIAL_ADMIN_PASSWORD must contain at least 8 characters.'
  );
}
    const adminPasswordHash = await hashPassword(adminRawPassword);

    const masterAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminPasswordHash,
        fullName: process.env.INITIAL_ADMIN_NAME || 'Viralstan Master Admin',
        role: Role.ADMIN,
        phone: process.env.INITIAL_ADMIN_PHONE || '+91 9876543210',
        department: 'Executive Management',
        designation: 'Managing Director',
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`✅ Single Master Admin created successfully: ${masterAdmin.email}`);
  } else {
    console.log(`ℹ️ Master Admin account already exists. Skipping.`);
  }

  console.log('🎉 Seed check completed. No demo or dummy records created.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
