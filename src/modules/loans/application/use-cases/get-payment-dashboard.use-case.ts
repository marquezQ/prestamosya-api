import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../../prisma/prisma.service';

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
  dueToday: DashboardInstallmentItem[];
  overdue: DashboardInstallmentItem[];
  paidToday: DashboardInstallmentItem[];
}

/**
 * Caso de uso de lectura: Dashboard de pagos del administrador.
 *
 * Devuelve 3 secciones:
 * 1. dueToday: Cuotas que vencen hoy y aún no han sido pagadas completamente.
 * 2. overdue: Cuotas con fecha de vencimiento anterior a hoy y aún no pagadas.
 * 3. paidToday: Cuotas cuya fecha de pago fue registrada hoy (paidAt >= hoy).
 *
 * El cálculo de daysOverdue se realiza en tiempo de consulta como la diferencia
 * en días entre la fecha actual y dueDate.
 */
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

@Injectable()
export class GetPaymentDashboardUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<PaymentDashboardResult> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // 1. Cuotas que vencen hoy y no están pagadas
    const dueTodayRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
          status: 'ACTIVE',
        },
        archived: false,
        dueDate: {
          gte: today,
          lt: tomorrow,
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

    // 2. Cuotas en mora (vencimiento anterior a hoy, no pagadas)
    const overdueRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
          status: 'ACTIVE',
        },
        archived: false,
        dueDate: {
          lt: today,
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

    // 3. Cuotas pagadas hoy (paidAt >= inicio de hoy)
    const paidTodayRaw = await this.prisma.installment.findMany({
      where: {
        loan: {
          client: { userId, deletedAt: null },
        },
        archived: false,
        status: 'PAID',
        paidAt: {
          gte: today,
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
      dueToday: dueTodayRaw.map((item) => this.mapToItem(item, today)),
      overdue: overdueRaw.map((item) => this.mapToItem(item, today)),
      paidToday: paidTodayRaw.map((item) => this.mapToItem(item, today)),
    };
  }

  private mapToItem(
    raw: RawInstallmentWithLoanAndClient,
    today: Date,
  ): DashboardInstallmentItem {
    const dueDate = new Date(raw.dueDate);
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
