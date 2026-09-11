import { Injectable } from '@nestjs/common';
import { PrismaClientLike } from '../../../../common/types/prisma.types';
import {
  CreatePaymentData,
  PaymentRecord,
  PaymentRepository,
} from '../../domain/repositories/payment.repository';

/**
 * Implementación concreta de PaymentRepository usando Prisma.
 *
 * Recibe PrismaClientLike en el constructor (igual que los demás repos)
 * para poder ser instanciado tanto con PrismaService normal como con
 * el cliente transaccional dentro del UnitOfWork.
 */
@Injectable()
export class PrismaPaymentRepository extends PaymentRepository {
  constructor(private readonly prisma: PrismaClientLike) {
    super();
  }

  /**
   * Crea el Payment y sus PaymentInstallments en una sola operación anidada.
   * Al llamarse dentro de UnitOfWork, está dentro de la transacción Prisma.
   */
  async create(data: CreatePaymentData): Promise<string> {
    const payment = await this.prisma.payment.create({
      data: {
        loanId: data.loanId,
        registeredBy: data.registeredBy,
        amount: data.amount,
        discountAmount: data.discountAmount ?? '0.00',
        paymentDate: data.paymentDate,
        method: data.method,
        notes: data.notes,
        installmentLinks: {
          create: data.installmentLinks.map((link) => ({
            installmentId: link.installmentId,
            interestPaid: link.interestPaid,
            capitalPaid: link.capitalPaid,
            interestDiscounted: link.interestDiscounted,
            capitalDiscounted: link.capitalDiscounted,
          })),
        },
      },
      select: { id: true },
    });

    return payment.id;
  }

  /**
   * Busca un payment por ID incluyendo sus links a cuotas.
   * Usado por VoidPaymentUseCase para cargar los montos a revertir.
   */
  async findById(id: string): Promise<PaymentRecord | null> {
    const raw = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        installmentLinks: {
          select: {
            id: true,
            installmentId: true,
            interestPaid: true,
            capitalPaid: true,
            interestDiscounted: true,
            capitalDiscounted: true,
          },
        },
      },
    });

    if (!raw) return null;

    return {
      id: raw.id,
      loanId: raw.loanId,
      registeredBy: raw.registeredBy,
      amount: String(raw.amount),
      discountAmount: String(raw.discountAmount),
      paymentDate: raw.paymentDate,
      method: raw.method,
      notes: raw.notes,
      voided: raw.voided,
      voidedAt: raw.voidedAt,
      voidReason: raw.voidReason,
      createdAt: raw.createdAt,
      installmentLinks: raw.installmentLinks.map((link) => ({
        id: link.id,
        installmentId: link.installmentId,
        interestPaid: String(link.interestPaid),
        capitalPaid: String(link.capitalPaid),
        interestDiscounted: String(link.interestDiscounted),
        capitalDiscounted: String(link.capitalDiscounted),
      })),
    };
  }

  /**
   * Marca un payment como anulado.
   * No elimina el registro — los pagos son inmutables por regla de negocio.
   */
  async markVoided(id: string, reason: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidReason: reason,
      },
    });
  }
}
