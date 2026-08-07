// Prepara la BD de test (prestamosya_test) para los tests E2E:
// aplica migraciones y seed apuntando a TEST_DATABASE_URL,
// sin tocar la BD de desarrollo.
require('dotenv').config();
const { execSync } = require('node:child_process');

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('Falta TEST_DATABASE_URL en .env');
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: testUrl };

console.log('>> Aplicando migraciones a la BD de test...');
execSync('pnpm exec prisma migrate deploy', { env, stdio: 'inherit' });

console.log('>> Sembrando datos de test...');
execSync('pnpm exec prisma db seed', { env, stdio: 'inherit' });

console.log('>> BD de test lista');
