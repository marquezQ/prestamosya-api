// src/modules/business-config/business-config.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessConfigResponseDto } from './dto/business-config-response.dto';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';

/**
 * Servicio de configuración del negocio (relación 1:1 con User).
 *
 * Usa el patrón UPSERT: si el usuario aún no tiene configuración, se crea con
 * los valores por defecto del schema al consultarla. Esto garantiza que la
 * pantalla de ajustes siempre tenga algo que mostrar.
 *
 * Las columnas Decimal de Prisma (`exchangeRate`, `defaultInterestRate`)
 * se escriben como string (convención del proyecto) y se leen como `number`.
 */
@Injectable()
export class BusinessConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve la configuración del negocio creándola con defaults si no existe. */
  async getForUser(userId: string): Promise<BusinessConfigResponseDto> {
    const config = await this.prisma.businessConfig.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return this.toResponseDto(config);
  }

  /** Actualiza parcialmente la configuración. Crea con defaults si no existe. */
  async updateForUser(
    userId: string,
    dto: UpdateBusinessConfigDto,
  ): Promise<BusinessConfigResponseDto> {
    const data = this.buildUpdateData(dto);

    const config = await this.prisma.businessConfig.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.toResponseDto(config);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Convierte el DTO en el objeto `data` para Prisma.
   * Solo incluye los campos realmente enviados (`undefined` se descarta),
   * para no sobrescribir columnas que el frontend no tocó.
   * Los valores Decimal se serializan como string (anti puntos flotantes).
   */
  private buildUpdateData(dto: UpdateBusinessConfigDto) {
    const data: {
      businessName?: string;
      primaryCurrency?: 'BOB' | 'USD';
      exchangeRate?: string;
      defaultInterestRate?: string;
      defaultPeriodType?:
        | 'daily'
        | 'weekly'
        | 'fortnightly'
        | 'monthly'
        | 'custom';
      graceDays?: number;
    } = {};

    if (dto.businessName !== undefined) {
      data.businessName = dto.businessName;
    }
    if (dto.primaryCurrency !== undefined) {
      data.primaryCurrency = dto.primaryCurrency;
    }
    if (dto.exchangeRate !== undefined) {
      data.exchangeRate = dto.exchangeRate.toString();
    }
    if (dto.defaultInterestRate !== undefined) {
      data.defaultInterestRate = dto.defaultInterestRate.toString();
    }
    if (dto.defaultPeriodType !== undefined) {
      data.defaultPeriodType = dto.defaultPeriodType;
    }
    if (dto.graceDays !== undefined) {
      data.graceDays = dto.graceDays;
    }

    return data;
  }

  /** Convierte el registro de BD en el DTO de respuesta (Decimal → number). */
  private toResponseDto(config: {
    id: string;
    businessName: string | null;
    primaryCurrency: 'BOB' | 'USD';
    /** Decimal de Prisma — compatible con cualquier tipo que implemente toString() */
    exchangeRate: { toString(): string };
    /** Decimal de Prisma — null si aún no se ha configurado */
    defaultInterestRate: { toString(): string } | null;
    defaultPeriodType:
      | 'daily'
      | 'weekly'
      | 'fortnightly'
      | 'monthly'
      | 'custom'
      | null;
    graceDays: number;
    createdAt: Date;
    updatedAt: Date;
  }): BusinessConfigResponseDto {
    return {
      id: config.id,
      businessName: config.businessName,
      primaryCurrency: config.primaryCurrency,
      exchangeRate: Number(config.exchangeRate),
      defaultInterestRate:
        config.defaultInterestRate !== null
          ? Number(config.defaultInterestRate)
          : null,
      defaultPeriodType: config.defaultPeriodType,
      graceDays: config.graceDays,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
