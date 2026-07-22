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
      name: 'Admin Principal',
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
      name: 'Admin Secundario',
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
        graceDays: 2,
      },
    });
  }
  console.log('✅ Business configs created for both admins');

  // ─── Clients for Admin 1 (2 clients) ─────────────────────────────────────

  const admin1Clients = [
    {
      fullName: 'Juan Pérez Mamani',
      phone: '71234567',
      idNumber: '1234567 LP',
      phoneAlt: '60123456',
      address: 'Av. 16 de Julio 1234, La Paz',
      notes: 'Cliente frecuente, prefiere cobro por las mañanas.',
    },
    {
      fullName: 'María Quispe Condori',
      phone: '72223344',
      idNumber: '7654321 LP',
      phoneAlt: null,
      address: 'Calle Comercio 567, El Alto',
      notes: null,
    },
  ];

  for (const data of admin1Clients) {
    await prisma.client.upsert({
      where: { idNumber: data.idNumber },
      update: {},
      create: {
        userId: admin1.id,
        fullName: data.fullName,
        phone: data.phone,
        idNumber: data.idNumber,
        phoneAlt: data.phoneAlt,
        address: data.address,
        notes: data.notes,
      },
    });
  }
  console.log(`✅ ${admin1Clients.length} clients created for Admin 1`);

  // ─── Clients for Admin 2 (1 client) ──────────────────────────────────────

  const admin2Clients = [
    {
      fullName: 'Carlos García Choque',
      phone: '73445566',
      idNumber: '9876543 LP',
      phoneAlt: null,
      address: 'Av. Panorámica 890, La Paz',
      notes: 'Nuevo cliente, referencia de Juan Pérez.',
    },
  ];

  for (const data of admin2Clients) {
    await prisma.client.upsert({
      where: { idNumber: data.idNumber },
      update: {},
      create: {
        userId: admin2.id,
        fullName: data.fullName,
        phone: data.phone,
        idNumber: data.idNumber,
        phoneAlt: data.phoneAlt,
        address: data.address,
        notes: data.notes,
      },
    });
  }
  console.log(`✅ ${admin2Clients.length} client created for Admin 2`);

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
