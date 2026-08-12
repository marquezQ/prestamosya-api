import { PrismaClient } from '../../generated/prisma/client';

/**
 * Tipo que representa al cliente Prisma dentro de una transacción interactiva.
 * Excluye los métodos de lifecycle y transacción que no están disponibles
 * dentro del callback de `prisma.$transaction(async (tx) => { ... })`.
 *
 * Se usa para que los repositorios de infraestructura acepten tanto
 * el PrismaService normal como el cliente transaccional.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$transaction' | '$extends' | '$on'
>;
