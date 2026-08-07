// Setup global de Jest para suites E2E (se ejecuta antes de cada suite).
// Carga el .env y apunta DATABASE_URL a la BD de test. El PrismaService lee
// process.env.DATABASE_URL, así evitamos tocar la BD de desarrollo.
import 'dotenv/config';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
