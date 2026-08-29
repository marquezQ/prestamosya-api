// src/prisma/prisma.service.ts
import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// IMPORTANTE: importar desde la ruta generada, NO desde "@prisma/client"
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Pool de conexiones con el driver nativo de pg. La zona horaria de la sesión
    // queda en UTC (default de PostgreSQL). @prisma/adapter-pg serializa los Date
    // en UTC sin sufijo de zona y normaliza la lectura a +00:00; forzar otra zona
    // (p. ej. America/La_Paz) desfasaría +4h/-4h todos los campos `timestamptz`.
    // La conversión a America/La_Paz se hace en la capa de aplicación/frontend.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Crear el adapter de Prisma para pg
    const adapter = new PrismaPg(pool);

    // En v7 es OBLIGATORIO pasar el adapter
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
