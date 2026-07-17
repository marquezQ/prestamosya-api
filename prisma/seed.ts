import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// ⚠️ CREDENCIALES DE DESARROLLO — Solo para seed inicial.
// Cambiar la contraseña en producción vía endpoint o script separado.
const SEED_USERNAME = 'admin';
const SEED_PASSWORD = 'admin123';
const BCRYPT_ROUNDS = 12; // Según CONVENTIONS.md

// Configurar el pool de conexiones con pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Instanciar el adaptador para pg (requerido en Prisma v7)
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos (seeding)...');

  // 1. Hashear la contraseña en runtime (12 rounds según CONVENTIONS.md)
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  // 2. Crear usuario administrador inicial
  const defaultAdmin = await prisma.user.upsert({
    where: { username: SEED_USERNAME },
    update: {
      passwordHash, // Permite actualizar/restaurar la contraseña si se vuelve a correr el seed
    },
    create: {
      name: 'Administrador Principal',
      username: SEED_USERNAME,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  console.log(
    `✅ Usuario administrador creado o existente: "${defaultAdmin.username}"`,
  );

  // 3. Crear configuración de negocio inicial
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
    `✅ Configuración de negocio inicial creada o existente para: "${defaultAdmin.name}"`,
  );
  console.log('🌱 Seeding finalizado con éxito.');
  console.log('');
  console.log('📋 Credenciales de desarrollo:');
  console.log(`   Username: ${SEED_USERNAME}`);
  console.log(`   Password: ${SEED_PASSWORD}`);
  console.log('   ⚠️  Cambiar en producción.');
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
