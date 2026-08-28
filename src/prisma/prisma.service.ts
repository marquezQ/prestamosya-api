// src/prisma/prisma.service.ts
import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// IMPORTANTE: importar desde la ruta generada, NO desde "@prisma/client"
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { LA_PAZ_TIMEZONE } from '../common/utils/date.utils';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Pool de conexiones con el driver nativo de pg. La zona horaria boliviana se
    // fija vía `options` (parámetro de conexión de PostgreSQL), que la aplica al
    // establecer la conexión — sin condición de carrera. Esto asegura que cualquier
    // valor de timestamps del lado DB (`CURRENT_TIMESTAMP`, `now()`) y los
    // SELECTs con formato de texto se resuelvan en America/La_Paz.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c timezone=${LA_PAZ_TIMEZONE}`,
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
