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

  const passwordHash = await bcrypt.hash('123456', BCRYPT_ROUNDS);

  const initialUsers = [
    {
      name: 'Pedro Marquez',
      username: 'pedromarquez',
      businessName: 'Préstamos YA - Pedro Marquez',
    },
    {
      name: 'Luis Fernando Marquez',
      username: 'luisfernandomarquez',
      businessName: 'Préstamos YA - Luis Fernando Marquez',
    },
    {
      name: 'Prestamos BancoSol',
      username: 'prestamosbancosol',
      businessName: 'Prestamos BancoSol',
    },
    {
      name: 'Juan Marquez',
      username: 'juanmarquez',
      businessName: 'Préstamos YA - Juan Marquez',
    },
    {
      name: 'Usuario Prueba',
      username: 'usuarioprueba',
      businessName: 'Préstamos YA - Usuario Prueba',
    },
  ];

  for (const u of initialUsers) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        passwordHash,
        role: 'admin',
        isActive: true,
      },
      create: {
        name: u.name,
        username: u.username,
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    });

    await prisma.businessConfig.upsert({
      where: { userId: user.id },
      update: {
        businessName: u.businessName,
      },
      create: {
        userId: user.id,
        businessName: u.businessName,
        primaryCurrency: 'BOB',
        exchangeRate: 6.96,
        defaultInterestRate: 10.0,
        defaultPeriodType: 'daily',
        graceDays: 0,
      },
    });

    console.log(
      `✅ Usuario creado/actualizado: "${user.username}" (${user.name})`,
    );
  }

  console.log('\n🌱 Seeding completado exitosamente.');
  console.log('📋 Usuarios creados (contraseña para todos: 123456):');
  console.log('   - pedromarquez');
  console.log('   - luisfernandomarquez');
  console.log('   - prestamosbancosol');
  console.log('   - juanmarquez');
}

main()
  .catch((e) => {
    console.error('❌ Seeding falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
