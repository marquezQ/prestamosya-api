import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── Admins ──────────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);

  const admin1 = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      name: 'Pedro Marquez Admin',
      username: 'admin',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });
  console.log(`✅ Admin 1: "${admin1.username}" (${admin1.id})`);

  const admin2 = await prisma.user.upsert({
    where: { username: 'admin2' },
    update: { passwordHash },
    create: {
      name: 'Luis Marquez Admin',
      username: 'admin2',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });
  console.log(`✅ Admin 2: "${admin2.username}" (${admin2.id})`);

  // ─── Business configs ────────────────────────────────────────────────────

  for (const user of [admin1, admin2]) {
    await prisma.businessConfig.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        businessName:
          user.id === admin1.id ? 'PrestamosYA SRL' : 'Creditos Rápidos',
        primaryCurrency: 'BOB',
        exchangeRate: 6.96,
        defaultInterestRate: 10.0,
        defaultPeriodType: 'daily',
        graceDays: 0,
      },
    });
  }
  console.log('✅ Business configs created for both admins');

  // ─── Clients for Admin 1 (2 clients) ─────────────────────────────────────

  const admin1Clients = [
    {
      fullName: 'Cliente Cumplido',
      phone: '71234567',
      idNumber: '1234567',
      phoneAlt: '60123456',
      address: 'Av. 16 de Julio 1234,',
      status: 'CURRENT' as const,
      notes: 'Cliente al día con sus pagos, prefiere cobro por las mañanas.',
    },
    {
      fullName: 'Cliente Moroso',
      phone: '72223344',
      idNumber: '7654321',
      phoneAlt: null,
      address: 'Calle Comercio 567',
      status: 'DELINQUENT' as const,
      notes: 'Cliente con cuotas retrasadas.',
    },
  ];

  for (const data of admin1Clients) {
    await prisma.client.upsert({
      where: { idNumber: data.idNumber },
      update: {
        fullName: data.fullName,
        status: data.status,
      },
      create: {
        userId: admin1.id,
        fullName: data.fullName,
        phone: data.phone,
        idNumber: data.idNumber,
        phoneAlt: data.phoneAlt,
        address: data.address,
        status: data.status,
        notes: data.notes,
      },
    });
  }
  console.log(
    `✅ ${admin1Clients.length} clients created for Admin 1 (Cumplido, Moroso)`,
  );

  // ─── Clients for Admin 2 (1 client) ──────────────────────────────────────

  const admin2Clients = [
    {
      fullName: 'Cliente Ejemplo',
      phone: '73445566',
      idNumber: '9876543',
      phoneAlt: null,
      address: 'Av. Panorámica 890',
      status: 'NO_LOAN' as const,
      notes: 'Cliente de ejemplo para Admin 2.',
    },
  ];

  for (const data of admin2Clients) {
    await prisma.client.upsert({
      where: { idNumber: data.idNumber },
      update: {
        fullName: data.fullName,
        status: data.status,
      },
      create: {
        userId: admin2.id,
        fullName: data.fullName,
        phone: data.phone,
        idNumber: data.idNumber,
        phoneAlt: data.phoneAlt,
        address: data.address,
        status: data.status,
        notes: data.notes,
      },
    });
  }
  console.log(
    `✅ ${admin2Clients.length} client created for Admin 2 (Ejemplo)`,
  );

  // ─── Done ────────────────────────────────────────────────────────────────

  console.log('\n🌱 Seeding completed successfully.');
  console.log('');
  console.log('📋 Credentials:');
  console.log('   Admin 1 — username: admin   / password: admin123');
  console.log('   Admin 2 — username: admin2  / password: admin123');
  console.log('   ⚠️  Change passwords in production.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
