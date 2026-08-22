import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  calculateDaysOverdue,
  getTodayLaPaz,
  subDays,
} from '../../../common/utils/date.utils';

export interface OverdueProcessResult {
  processedAt: string;
  todayReference: string;
  updatedInstallmentsCount: number;
  markedDelinquentClientsCount: number;
  restoredCurrentClientsCount: number;
}

/**
 * Servicio procesador de mora y recálculo diario.
 *
 * Responsabilidades:
 * 1. Calcular cuotas vencidas (dueDate < hoy - graceDays) y pasarlas a status = OVERDUE.
 * 2. Actualizar el campo daysOverdue para todas las cuotas no pagadas.
 * 3. Marcar clientes con cuotas en mora como DELINQUENT.
 * 4. Restaurar clientes sin cuotas en mora a estado CURRENT (si estaban DELINQUENT).
 * 5. Garantizar idempotencia total (puede ejecutarse N veces sin alterar resultados).
 */
@Injectable()
export class OverdueProcessorService {
  private readonly logger = new Logger(OverdueProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el recálculo diario de mora.
   *
   * @param referenceDate Fecha opcional para simular el recálculo en un día específico (por defecto la fecha actual en America/La_Paz).
   */
  async processOverdue(referenceDate?: Date): Promise<OverdueProcessResult> {
    const today = referenceDate
      ? getTodayLaPaz(referenceDate)
      : getTodayLaPaz();
    const todayStr = today.toISOString().split('T')[0];

    this.logger.log(
      `[OverdueProcessor] 🔄 Iniciando recálculo de mora para la fecha ${todayStr} (America/La_Paz)...`,
    );

    // 1. Cargar días de gracia por administrador/usuario
    const configs = await this.prisma.businessConfig.findMany({
      select: {
        userId: true,
        graceDays: true,
      },
    });

    const userGraceDaysMap = new Map<string, number>();
    for (const cfg of configs) {
      userGraceDaysMap.set(cfg.userId, cfg.graceDays);
    }

    // 2. Obtener todas las cuotas no pagadas de préstamos activos
    const pendingInstallments = await this.prisma.installment.findMany({
      where: {
        archived: false,
        status: { not: 'PAID' },
        loan: {
          status: 'ACTIVE',
          client: { deletedAt: null },
        },
      },
      include: {
        loan: {
          select: {
            id: true,
            clientId: true,
            createdBy: true,
          },
        },
      },
    });

    let updatedInstallmentsCount = 0;
    const installmentsToUpdate: Array<{
      id: string;
      status?: 'OVERDUE' | 'PENDING' | 'PARTIAL';
      daysOverdue: number;
    }> = [];

    for (const inst of pendingInstallments) {
      const graceDays = userGraceDaysMap.get(inst.loan.createdBy) ?? 0;
      const cutoffDate = subDays(today, graceDays);

      const due = new Date(inst.dueDate);
      const isOverdue = due < cutoffDate;
      const { daysOverdue } = calculateDaysOverdue(due, today);

      let nextStatus = inst.status;

      if (isOverdue) {
        if (inst.status === 'PENDING') {
          nextStatus = 'OVERDUE';
        }
      } else {
        // Si no ha superado los días de gracia pero estaba en OVERDUE (ej: cambio de config), restaurar
        if (inst.status === 'OVERDUE') {
          nextStatus = Number(inst.paidAmount) > 0 ? 'PARTIAL' : 'PENDING';
        }
      }

      // Si cambió de estado o cambió el número de días de mora, actualizar
      if (nextStatus !== inst.status || daysOverdue !== inst.daysOverdue) {
        installmentsToUpdate.push({
          id: inst.id,
          status: nextStatus as 'OVERDUE' | 'PENDING' | 'PARTIAL',
          daysOverdue,
        });
      }
    }

    // 3. Aplicar actualizaciones de cuotas en transacción
    if (installmentsToUpdate.length > 0) {
      await this.prisma.$transaction(
        installmentsToUpdate.map((i) =>
          this.prisma.installment.update({
            where: { id: i.id },
            data: {
              ...(i.status && { status: i.status }),
              daysOverdue: i.daysOverdue,
            },
          }),
        ),
      );
      updatedInstallmentsCount = installmentsToUpdate.length;
    }

    // 4. Evaluar y actualizar estado de clientes (DELINQUENT vs CURRENT)
    // Cargar todos los clientes que tienen al menos un préstamo activo
    const activeClients = await this.prisma.client.findMany({
      where: {
        deletedAt: null,
        status: { in: ['CURRENT', 'DELINQUENT'] },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        loans: {
          where: { status: 'ACTIVE' },
          select: {
            createdBy: true,
            installments: {
              where: {
                archived: false,
                status: { not: 'PAID' },
              },
              select: {
                dueDate: true,
              },
            },
          },
        },
      },
    });

    const clientsToDelinquent: string[] = [];
    const clientsToCurrent: string[] = [];

    for (const client of activeClients) {
      const graceDays = userGraceDaysMap.get(client.userId) ?? 0;
      const cutoffDate = subDays(today, graceDays);

      let hasOverdueInstallment = false;

      for (const loan of client.loans) {
        for (const inst of loan.installments) {
          const due = new Date(inst.dueDate);
          if (due < cutoffDate) {
            hasOverdueInstallment = true;
            break;
          }
        }
        if (hasOverdueInstallment) break;
      }

      if (hasOverdueInstallment && client.status !== 'DELINQUENT') {
        clientsToDelinquent.push(client.id);
      } else if (!hasOverdueInstallment && client.status === 'DELINQUENT') {
        clientsToCurrent.push(client.id);
      }
    }

    if (clientsToDelinquent.length > 0) {
      await this.prisma.client.updateMany({
        where: { id: { in: clientsToDelinquent } },
        data: { status: 'DELINQUENT' },
      });
    }

    if (clientsToCurrent.length > 0) {
      await this.prisma.client.updateMany({
        where: { id: { in: clientsToCurrent } },
        data: { status: 'CURRENT' },
      });
    }

    const result: OverdueProcessResult = {
      processedAt: new Date().toISOString(),
      todayReference: todayStr,
      updatedInstallmentsCount,
      markedDelinquentClientsCount: clientsToDelinquent.length,
      restoredCurrentClientsCount: clientsToCurrent.length,
    };

    this.logger.log(
      `[OverdueProcessor] ✅ Recálculo completado exitosamente: ` +
        `${updatedInstallmentsCount} cuotas actualizadas, ` +
        `${clientsToDelinquent.length} clientes pasaron a MOROSO (DELINQUENT), ` +
        `${clientsToCurrent.length} clientes restaurados AL DÍA (CURRENT).`,
    );

    return result;
  }
}
