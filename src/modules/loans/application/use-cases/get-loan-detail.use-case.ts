import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class GetLoanDetailUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, loanId: string) {
    const rawLoan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        client: { userId, deletedAt: null },
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            idNumber: true,
            phone: true,
          },
        },
        installments: {
          where: { archived: false },
          orderBy: { installmentNumber: 'asc' },
        },
        guarantees: {
          where: { status: 'ACTIVE' },
          include: { guarantee: true },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!rawLoan) {
      throw new NotFoundException('Loan not found');
    }

    return {
      loan: {
        id: rawLoan.id,
        clientId: rawLoan.clientId,
        clientName: rawLoan.client.fullName,
        clientIdNumber: rawLoan.client.idNumber,
        createdBy: rawLoan.createdBy,
        mode: rawLoan.mode,
        capitalAmount: Number(rawLoan.capitalAmount),
        currency: rawLoan.currency,
        interestRate: Number(rawLoan.interestRate),
        periodType: rawLoan.periodType,
        totalInstallments: rawLoan.totalInstallments,
        totalAmount: Number(rawLoan.totalAmount),
        totalPaid: Number(rawLoan.totalPaid),
        outstandingBalance: Number(rawLoan.outstandingBalance),
        status: rawLoan.status,
        startDate: rawLoan.startDate.toISOString().split('T')[0],
        firstDueDate: rawLoan.firstDueDate.toISOString().split('T')[0],
        notes: rawLoan.notes,
        createdAt: rawLoan.createdAt,
      },
      installments: rawLoan.installments.map((i) => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate.toISOString().split('T')[0],
        capitalAmount: Number(i.capitalAmount),
        interestAmount: Number(i.interestAmount),
        totalAmount: Number(i.totalAmount),
        paidAmount: Number(i.paidAmount),
        remainingAmount: Number(i.totalAmount) - Number(i.paidAmount),
        status: i.status,
        daysOverdue: i.daysOverdue,
        paidAt: i.paidAt ? i.paidAt.toISOString().split('T')[0] : null,
      })),
      guarantees: rawLoan.guarantees.map((lg) => ({
        linkId: lg.id,
        id: lg.guarantee.id,
        type: lg.guarantee.type,
        description: lg.guarantee.description,
        estimatedValue: lg.guarantee.estimatedValue
          ? Number(lg.guarantee.estimatedValue)
          : null,
        status: lg.guarantee.status,
      })),
      payments: rawLoan.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString().split('T')[0],
        method: p.method,
        notes: p.notes,
        voided: p.voided,
        voidedAt: p.voidedAt,
        voidReason: p.voidReason,
        createdAt: p.createdAt,
      })),
    };
  }

  async getInstallments(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, client: { userId, deletedAt: null } },
      select: { id: true },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const installments = await this.prisma.installment.findMany({
      where: { loanId, archived: false },
      orderBy: { installmentNumber: 'asc' },
    });

    return installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      dueDate: i.dueDate.toISOString().split('T')[0],
      capitalAmount: Number(i.capitalAmount),
      interestAmount: Number(i.interestAmount),
      totalAmount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      remainingAmount: Number(i.totalAmount) - Number(i.paidAmount),
      status: i.status,
      daysOverdue: i.daysOverdue,
      paidAt: i.paidAt ? i.paidAt.toISOString().split('T')[0] : null,
    }));
  }
}
