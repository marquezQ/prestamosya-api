import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  getTodayLaPaz,
  getStartOfDay,
} from '../../../../common/utils/date.utils';
import { HomeDashboardResponseDto } from '../../dto/home-dashboard-response.dto';

@Injectable()
export class GetHomeDashboardUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<HomeDashboardResponseDto> {
    const today = getTodayLaPaz();

    // 1. Obtener todos los préstamos ACTIVOS del usuario con sus cuotas no archivadas ni completadas
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        createdBy: userId,
        status: 'ACTIVE',
        client: { deletedAt: null },
      },
      select: {
        id: true,
        currency: true,
        clientId: true,
        installments: {
          where: {
            archived: false,
          },
          select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            capitalAmount: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
            daysOverdue: true,
          },
        },
      },
    });

    // 2. Calcular Capital en Calle desglosado por moneda (BOB / USD)
    let capitalEnCalleBOB = 0;
    let capitalEnCalleUSD = 0;

    // Trackers para préstamos y clientes morosos/al día
    const delinquentLoanIds = new Set<string>();
    const upToDateLoanIds = new Set<string>();
    const delinquentClientIds = new Set<string>();
    const upToDateClientIds = new Set<string>();

    for (const loan of activeLoans) {
      let loanIsDelinquent = false;

      for (const inst of loan.installments) {
        const totalAmt = Number(inst.totalAmount);
        const interestAmt = Number(inst.interestAmount);
        const paidAmt = Number(inst.paidAmount);

        // Si la cuota aún no está pagada completamente (status != PAID)
        if (inst.status !== 'PAID') {
          // Aritmética de amortización: pago va primero a interés y luego a capital
          const remainingInterest = Math.max(0, interestAmt - paidAmt);
          const remainingCapital = Math.max(
            0,
            totalAmt - paidAmt - remainingInterest,
          );

          if (loan.currency === 'USD') {
            capitalEnCalleUSD += remainingCapital;
          } else {
            capitalEnCalleBOB += remainingCapital;
          }

          // Verificar si la cuota está vencida (estado OVERDUE o fecha de vencimiento previa a hoy)
          const instDueDate = getStartOfDay(new Date(inst.dueDate));
          if (inst.status === 'OVERDUE' || instDueDate < today) {
            loanIsDelinquent = true;
          }
        }
      }

      if (loanIsDelinquent) {
        delinquentLoanIds.add(loan.id);
        delinquentClientIds.add(loan.clientId);
      } else {
        upToDateLoanIds.add(loan.id);
        upToDateClientIds.add(loan.clientId);
      }
    }

    const totalActiveLoans = activeLoans.length;
    const totalDelinquentLoans = delinquentLoanIds.size;
    const totalUpToDateLoans = totalActiveLoans - totalDelinquentLoans;
    const delinquencyRate =
      totalActiveLoans > 0
        ? Math.round((totalDelinquentLoans / totalActiveLoans) * 10000) / 100
        : 0;

    // 3. Resumen de Clientes
    const totalClientsCount = await this.prisma.client.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    const countDelinquentClients = delinquentClientIds.size;
    // Clientes al día son los que tienen préstamo activo al día Y no tienen ningún préstamo moroso
    const countCurrentClients = Array.from(upToDateClientIds).filter(
      (cId) => !delinquentClientIds.has(cId),
    ).length;
    const countNoLoanClients = Math.max(
      0,
      totalClientsCount - (countDelinquentClients + countCurrentClients),
    );

    // 4. Lista prioritaria de Cuotas Vencidas (Morosos)
    const overdueInstallmentsRaw = await this.prisma.installment.findMany({
      where: {
        archived: false,
        status: { in: ['OVERDUE', 'PENDING', 'PARTIAL'] },
        dueDate: { lt: today },
        loan: {
          createdBy: userId,
          status: 'ACTIVE',
          client: { deletedAt: null },
        },
      },
      include: {
        loan: {
          select: {
            id: true,
            currency: true,
            client: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ daysOverdue: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    });

    const overdueInstallments = overdueInstallmentsRaw.map((inst) => {
      const dueDate = getStartOfDay(new Date(inst.dueDate));
      const diffMs = today.getTime() - dueDate.getTime();
      const calculatedDaysOverdue = Math.max(
        0,
        Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      );
      const daysOverdue = Math.max(inst.daysOverdue, calculatedDaysOverdue);

      const expectedAmount = Number(inst.totalAmount);
      const paidAmount = Number(inst.paidAmount);
      const pendingAmount = Math.max(0, expectedAmount - paidAmount);

      const rawFullName = inst.loan.client.fullName || '';
      const nameParts = rawFullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        installmentId: inst.id,
        loanId: inst.loan.id,
        installmentNumber: inst.installmentNumber,
        currency: inst.loan.currency,
        client: {
          id: inst.loan.client.id,
          fullName: rawFullName,
          firstName,
          lastName,
          phone: inst.loan.client.phone || '',
        },
        dueDate: inst.dueDate.toISOString().split('T')[0],
        daysOverdue,
        expectedAmount,
        paidAmount,
        pendingAmount,
      };
    });

    return {
      capitalEnCalle: {
        BOB: Math.round(capitalEnCalleBOB * 100) / 100,
        USD: Math.round(capitalEnCalleUSD * 100) / 100,
      },
      loansSummary: {
        totalActive: totalActiveLoans,
        totalUpToDate: totalUpToDateLoans,
        totalDelinquent: totalDelinquentLoans,
        delinquencyRate,
      },
      clientsSummary: {
        totalClients: totalClientsCount,
        currentClients: countCurrentClients,
        delinquentClients: countDelinquentClients,
        noLoanClients: countNoLoanClients,
      },
      overdueInstallments,
      generatedAt: new Date().toISOString(),
    };
  }
}
