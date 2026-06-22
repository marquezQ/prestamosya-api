import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Configurar el pool de conexiones con pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Instanciar el adaptador para pg (requerido en Prisma v7)
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos (seeding)...');

  // 1. Crear usuario administrador inicial
  // Nota: El hash de la contraseña de ejemplo corresponde a "admin123" usando bcrypt
  const adminUsername = 'admin';
  const defaultAdmin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      name: 'Administrador Principal',
      username: adminUsername,
      passwordHash:
        '$2b$10$y5U6.s4h.6J8TqR5jJ6hdeU2Hh1kF883F21tHjRzE4z1O6eF3/bWy', // hash para "admin123"
      role: 'admin',
      isActive: true,
    },
  });

  console.log(
    `✅ Usuario administrador creado o existente: "${defaultAdmin.username}"`,
  );

  await prisma.businessConfig.upsert({
    where: { userId: defaultAdmin.id },
    update: {},
    create: {
      userId: defaultAdmin.id,
      businessName: 'PrestamosYA SRL',
      primaryCurrency: 'BOB',
      exchangeRate: 6.96,
      defaultInterestRate: 10.0,
      defaultPeriodType: 'daily',
      graceDays: 2,
    },
  });

  console.log(
    `✅ Configuración de negocio inicial creada o existente para el usuario: "${defaultAdmin.name}"`,
  );
  console.log('🌱 Seeding finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seeding de la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Cerrar las conexiones de Prisma y pg pool
    await prisma.$disconnect();
    await pool.end();
  });
