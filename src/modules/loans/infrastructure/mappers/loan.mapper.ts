import Decimal from 'decimal.js';
import {
  Loan as PrismaLoan,
  Installment as PrismaInstallment,
} from '../../../../generated/prisma/client';
import { LoanEntity } from '../../domain/entities/loan.entity';
import { LoanMode, LoanStatus, PeriodType } from '../../domain/enums';
import { Money } from '../../domain/value-objects/money.vo';
import { InstallmentMapper } from './installment.mapper';

type RawLoanWithInstallments = PrismaLoan & {
  installments?: PrismaInstallment[];
};

/**
 * Mapper para convertir entre registros Prisma de Loan,
 * la entidad de dominio LoanEntity y los DTOs de la API.
 */
export class LoanMapper {
  /**
   * Convierte un registro Prisma a una entidad de dominio LoanEntity.
   */
  static toDomain(raw: RawLoanWithInstallments): LoanEntity {
    const currency = raw.currency;

    const installments = raw.installments
      ? raw.installments.map((i) => InstallmentMapper.toDomain(i, currency))
      : [];

    return new LoanEntity(
      raw.id,
      raw.clientId,
      raw.createdBy,
      raw.mode as LoanMode,
      Money.of(new Decimal(raw.capitalAmount.toString()), currency),
      new Decimal(raw.interestRate.toString()),
      raw.periodType ? (raw.periodType as PeriodType) : null,
      raw.totalInstallments,
      Money.of(new Decimal(raw.totalAmount.toString()), currency),
      Money.of(new Decimal(raw.totalPaid.toString()), currency),
      Money.of(new Decimal(raw.outstandingBalance.toString()), currency),
      raw.status as LoanStatus,
      raw.startDate,
      raw.firstDueDate,
      raw.notes,
      installments,
    );
  }

  /**
   * Mapea una entidad LoanEntity a un objeto compatible con prisma.loan.create.
   */
  static toPrismaCreate(entity: LoanEntity) {
    return {
      clientId: entity.clientId,
      createdBy: entity.createdBy,
      mode: entity.mode,
      capitalAmount: entity.capitalAmount.toString(),
      currency: entity.currency,
      interestRate: entity.interestRate.toString(),
      periodType: entity.periodType,
      totalInstallments: entity.totalInstallments,
      totalAmount: entity.totalAmount.toString(),
      totalPaid: entity.totalPaid.toString(),
      outstandingBalance: entity.outstandingBalance.toString(),
      status: entity.status,
      startDate: entity.startDate,
      firstDueDate: entity.firstDueDate,
      notes: entity.notes,
    };
  }

  /**
   * Mapea una entidad LoanEntity a la respuesta JSON estructurada para la API.
   * Los montos monetarios se entregan formateados como strings con 2 decimales.
   */
  static toResponseDto(entity: LoanEntity) {
    return {
      id: entity.id,
      clientId: entity.clientId,
      createdBy: entity.createdBy,
      mode: entity.mode,
      capitalAmount: entity.capitalAmount.toString(),
      currency: entity.currency,
      interestRate: entity.interestRate.toNumber(),
      periodType: entity.periodType,
      totalInstallments: entity.totalInstallments,
      totalAmount: entity.totalAmount.toString(),
      totalPaid: entity.totalPaid.toString(),
      outstandingBalance: entity.outstandingBalance.toString(),
      status: entity.status,
      startDate: entity.startDate.toISOString().split('T')[0],
      firstDueDate: entity.firstDueDate.toISOString().split('T')[0],
      notes: entity.notes,
      installments: entity.installments.map((i) =>
        InstallmentMapper.toResponseDto(i),
      ),
    };
  }
}
