import Decimal from 'decimal.js';
import { Installment as PrismaInstallment } from '../../../../generated/prisma/client';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { InstallmentStatus } from '../../domain/enums';
import { Currency, Money } from '../../domain/value-objects/money.vo';

/**
 * Mapper para convertir entre el modelo Installment de Prisma
 * y la entidad de dominio InstallmentEntity.
 */
export class InstallmentMapper {
  /**
   * Convierte un registro de Prisma a una entidad de dominio.
   */
  static toDomain(
    raw: PrismaInstallment,
    currency: Currency = 'BOB',
  ): InstallmentEntity {
    return new InstallmentEntity(
      raw.id,
      raw.loanId,
      raw.installmentNumber,
      raw.dueDate,
      Money.of(new Decimal(raw.capitalAmount.toString()), currency),
      Money.of(new Decimal(raw.interestAmount.toString()), currency),
      Money.of(new Decimal(raw.totalAmount.toString()), currency),
      Money.of(new Decimal(raw.paidAmount.toString()), currency),
      raw.status as InstallmentStatus,
      raw.daysOverdue,
      raw.paidAt,
      raw.archived,
    );
  }

  /**
   * Mapea una entidad de dominio a objeto listo para la creación en Prisma.
   */
  static toPrismaCreate(entity: InstallmentEntity, loanId: string) {
    return {
      loanId,
      installmentNumber: entity.installmentNumber,
      dueDate: entity.dueDate,
      capitalAmount: entity.capitalAmount.toString(),
      interestAmount: entity.interestAmount.toString(),
      totalAmount: entity.totalAmount.toString(),
      paidAmount: entity.paidAmount.toString(),
      status: entity.status,
      daysOverdue: entity.daysOverdue,
      paidAt: entity.paidAt,
      archived: entity.archived,
    };
  }

  /**
   * Mapea una entidad de dominio a DTO de respuesta para la API.
   */
  static toResponseDto(entity: InstallmentEntity) {
    return {
      id: entity.id,
      installmentNumber: entity.installmentNumber,
      dueDate: entity.dueDate.toISOString().split('T')[0],
      capitalAmount: entity.capitalAmount.toString(),
      interestAmount: entity.interestAmount.toString(),
      totalAmount: entity.totalAmount.toString(),
      paidAmount: entity.paidAmount.toString(),
      remainingAmount: entity.remainingAmount.toString(),
      status: entity.status,
      daysOverdue: entity.daysOverdue,
      paidAt: entity.paidAt ? entity.paidAt.toISOString() : null,
      archived: entity.archived,
    };
  }
}
