import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  getTodayLaPaz,
  getStartOfDay,
} from '../../../../common/utils/date.utils';

export interface DashboardInstallmentItem {
  installmentId: string;
  installmentNumber: number;
  loanId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  daysOverdue: number;
  paidAt: string | null;
}

export interface PaymentDashboardResult {
  metadata: {
    targetDate: string;
    serverToday: string;
  };
  dueToday: DashboardInstallmentItem[];
  overdue: DashboardInstallmentItem[];
  paidToday: DashboardInstallmentItem[];
}

interface RawInstallmentWithLoanAndClient {
  id: string;
  installmentNumber: number;
  loanId: string;
  dueDate: Date;
  totalAmount: Decimal | number | string;
  paidAmount: Decimal | number | string;
  status: string;
  paidAt: Date | null;
  loan: {
    client: {
      id: string;
      fullName: string;
      phone: string;
    };
  };
}

/**
 * Caso de uso de lectura: Dashboard dinámico de pagos del cobrador/administrador.
 *
 * Soporta navegación por fechas en el calendario/agenda de la UI mediante `targetDateStr` (opcional).
 * Devuelve 3 secciones:
 * 1. dueToday: Cuotas que vencen en la fecha seleccionada (targetDate) y aún no han sido pagadas completamente.
 * 2. overdue: Cuotas vencidas no pagadas (dueDate < fecha corte actual).
 * 3. paidToday: Cuotas cuyos pagos fueron registrados en la fecha seleccionada.
 */
@Injectable()
export class GetPaymentDashboardUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    userId: string,
    targetDateStr?: string,
  ): Promise<PaymentDashboardResult> {
    const serverToday = getTodayLaPaz();
    const serverTodayStr = serverToday.toISOString().split('T')[0];

    // Fecha objetivo seleccionada por el usuario (o hoy por defecto)
    const targetDate = targetDateStr
      ? new Date(`${targetDateStr}T00:00:00.000Z`)
      : serverToday;

    const targetDateFormattedStr = targetDate.toISOString().split('T')[0];

    const targetTomorrow = new Date(targetDate);
    targetTomorrow.setUTCDate(targetTomorrow.getUTCDate() + 1);

    // Para la sección overdue, si el cobrador consulta una fecha futura,
    // las cuotas verdaderamente en mora son las que ya vencieron respecto a hoy o la fecha dada.
    const overdueCutoffDate =
      targetDate < serverToday ? targetDate : serverToday;

    // 1. Cuotas que vencen en la fecha seleccionada (targetDate) y no están pagadas
    const dueTodayRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
          status: 'ACTIVE',
        },
        archived: false,
        dueDate: {
          gte: targetDate,
          lt: targetTomorrow,
        },
        status: { not: 'PAID' },
      },
      include: {
        loan: {
          include: {
            client: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 2. Cuotas en mora (vencimiento anterior a la fecha de corte, no pagadas)
    const overdueRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
          status: 'ACTIVE',
        },
        archived: false,
        dueDate: {
          lt: overdueCutoffDate,
        },
        status: { not: 'PAID' },
      },
      include: {
        loan: {
          include: {
            client: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 3. Cuotas pagadas en la fecha seleccionada (paidAt >= inicio de targetDate y < targetTomorrow)
    const paidTodayRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
        },
        archived: false,
        status: 'PAID',
        paidAt: {
          gte: targetDate,
          lt: targetTomorrow,
        },
      },
      include: {
        loan: {
          include: {
            client: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    return {
      metadata: {
        targetDate: targetDateFormattedStr,
        serverToday: serverTodayStr,
      },
      dueToday: dueTodayRaw.map((item) => this.mapToItem(item, serverToday)),
      overdue: overdueRaw.map((item) => this.mapToItem(item, serverToday)),
      paidToday: paidTodayRaw.map((item) => this.mapToItem(item, serverToday)),
    };
  }

  private mapToItem(
    raw: RawInstallmentWithLoanAndClient,
    today: Date,
  ): DashboardInstallmentItem {
    const dueDate = getStartOfDay(new Date(raw.dueDate));
    const diffTime = today.getTime() - dueDate.getTime();
    const daysOverdue = Math.max(
      0,
      Math.floor(diffTime / (1000 * 60 * 60 * 24)),
    );

    const totalAmount = Number(raw.totalAmount);
    const paidAmount = Number(raw.paidAmount);

    return {
      installmentId: raw.id,
      installmentNumber: raw.installmentNumber,
      loanId: raw.loanId,
      clientId: raw.loan.client.id,
      clientName: raw.loan.client.fullName,
      clientPhone: raw.loan.client.phone,
      dueDate: raw.dueDate.toISOString().split('T')[0],
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      status: raw.status,
      daysOverdue,
      paidAt: raw.paidAt ? raw.paidAt.toISOString() : null,
    };
  }
}
