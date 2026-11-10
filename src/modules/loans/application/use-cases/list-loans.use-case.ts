import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { getTodayLaPaz, subDays } from '../../../../common/utils/date.utils';
import {
  ListLoansQueryDto,
  LoanFilterScope,
} from '../../dto/list-loans.query.dto';
import { LoanListItemDto } from '../../dto/loan-list-item.dto';

@Injectable()
export class ListLoansUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    userId: string,
    query: ListLoansQueryDto,
  ): Promise<LoanListItemDto[]> {
    const filter = query.filter ?? LoanFilterScope.ACTIVE;
    const today = getTodayLaPaz();

    // 1. Obtener días de gracia de la configuración del usuario
    const businessConfig = await this.prisma.businessConfig.findUnique({
      where: { userId },
      select: { graceDays: true },
    });
    const graceDays = businessConfig?.graceDays ?? 0;
    const cutoffDate = subDays(today, graceDays);

    // 2. Determinar estado de préstamo en base de datos
    // Si el filtro es 'completed', buscamos préstamos COMPLETED.
    // Para 'active', 'up_to_date' y 'overdue', buscamos préstamos ACTIVE.
    const statusCondition =
      filter === LoanFilterScope.COMPLETED ? 'COMPLETED' : 'ACTIVE';

    // 3. Filtro opcional de búsqueda por nombre o carnet
    const searchFilter = query.search
      ? {
          OR: [
            {
              fullName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              idNumber: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    // 4. Consulta optimizada a Prisma
    const rawLoans = await this.prisma.loan.findMany({
      where: {
        createdBy: userId,
        status: statusCondition,
        client: {
          deletedAt: null,
          ...searchFilter,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            idNumber: true,
            phone: true,
            photoUrl: true,
          },
        },
        installments: {
          where: { archived: false },
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            status: true,
            paidAmount: true,
            totalAmount: true,
          },
        },
      },
    });

    // 5. Procesar cada préstamo y clasificar
    const result: LoanListItemDto[] = [];

    for (const loan of rawLoans) {
      let isDelinquent = false;
      let overdueCount = 0;
      let paidCount = 0;
      let nextDueDate: string | null = null;

      for (const inst of loan.installments) {
        if (inst.status === 'PAID') {
          paidCount++;
          continue;
        }

        // Si la cuota no está pagada totalmente:
        const dueDate = new Date(inst.dueDate);
        const isOverdue = inst.status === 'OVERDUE' || dueDate < cutoffDate;

        if (isOverdue) {
          isDelinquent = true;
          overdueCount++;
        }

        // Registrar la primera cuota pendiente como la próxima fecha de vencimiento
        if (!nextDueDate) {
          nextDueDate = inst.dueDate.toISOString().split('T')[0];
        }
      }

      // Aplicar filtros específicos de sub-estado de cartera
      if (filter === LoanFilterScope.UP_TO_DATE && isDelinquent) {
        continue;
      }
      if (filter === LoanFilterScope.OVERDUE && !isDelinquent) {
        continue;
      }

      result.push({
        id: loan.id,
        currency: loan.currency,
        mode: loan.mode,
        scheduleType: loan.scheduleType,
        capitalAmount: Number(loan.capitalAmount.toString()),
        interestRate: Number(loan.interestRate.toString()),
        periodType: loan.periodType,
        totalInstallments: loan.totalInstallments,
        totalAmount: Number(loan.totalAmount.toString()),
        totalPaid: Number(loan.totalPaid.toString()),
        outstandingBalance: Number(loan.outstandingBalance.toString()),
        status: loan.status,
        startDate: loan.startDate.toISOString().split('T')[0],
        nextDueDate,
        isDelinquent,
        paidInstallments: paidCount,
        overdueInstallmentsCount: overdueCount,
        client: {
          id: loan.client.id,
          fullName: loan.client.fullName,
          idNumber: loan.client.idNumber,
          phone: loan.client.phone,
          photoUrl: loan.client.photoUrl,
        },
        createdAt: loan.createdAt,
      });
    }

    return result;
  }
}
