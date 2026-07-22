import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuaranteeStatus,
  InstallmentStatus,
  LoanStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const clients = await this.prisma.client.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: clients.map((client) => this.toClientResponse(client)),
    };
  }

  async create(userId: string, dto: CreateClientDto) {
    try {
      const client = await this.prisma.client.create({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          idNumber: dto.idNumber,
          phoneAlt: dto.phoneAlt,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          notes: dto.notes,
        },
      });

      return { data: this.toClientResponse(client) };
    } catch (error) {
      this.throwIfDuplicateCi(error);
      throw error;
    }
  }

  async findOne(userId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        guarantees: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        loans: {
          where: { status: LoanStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          include: {
            installments: {
              where: { archived: false },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const summaryByCurrency = new Map<
      string,
      {
        currency: string;
        totalOwed: number;
        overdueInstallments: number;
        overdueAmount: number;
      }
    >();

    const activeLoans = client.loans.map((loan) => {
      const summary = summaryByCurrency.get(loan.currency) ?? {
        currency: loan.currency,
        totalOwed: 0,
        overdueInstallments: 0,
        overdueAmount: 0,
      };
      summary.totalOwed += this.decimalToNumber(loan.outstandingBalance);

      for (const installment of loan.installments) {
        if (installment.status === InstallmentStatus.OVERDUE) {
          summary.overdueInstallments += 1;
          summary.overdueAmount += Math.max(
            0,
            this.decimalToNumber(installment.totalAmount) -
              this.decimalToNumber(installment.paidAmount),
          );
        }
      }
      summaryByCurrency.set(loan.currency, summary);

      const nextInstallment = loan.installments.find(
        (installment) => installment.status !== InstallmentStatus.PAID,
      );

      return {
        id: loan.id,
        currency: loan.currency,
        totalAmount: this.decimalToNumber(loan.totalAmount),
        outstandingBalance: this.decimalToNumber(loan.outstandingBalance),
        startDate: loan.startDate,
        nextInstallment: nextInstallment
          ? {
              id: nextInstallment.id,
              number: nextInstallment.installmentNumber,
              dueDate: nextInstallment.dueDate,
              pendingAmount: Math.max(
                0,
                this.decimalToNumber(nextInstallment.totalAmount) -
                  this.decimalToNumber(nextInstallment.paidAmount),
              ),
              status: nextInstallment.status,
            }
          : null,
      };
    });

    return {
      data: {
        client: this.toClientResponse(client),
        activeLoans,
        guarantees: client.guarantees.map((guarantee) => ({
          id: guarantee.id,
          type: guarantee.type,
          description: guarantee.description,
          estimatedValue: guarantee.estimatedValue
            ? this.decimalToNumber(guarantee.estimatedValue)
            : null,
          status:
            guarantee.status === GuaranteeStatus.IN_USE
              ? 'IN_USE'
              : 'AVAILABLE',
          createdAt: guarantee.createdAt,
        })),
        financialSummary: Array.from(summaryByCurrency.values()).map(
          (summary) => ({
            ...summary,
            totalOwed: this.roundMoney(summary.totalOwed),
            overdueAmount: this.roundMoney(summary.overdueAmount),
          }),
        ),
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    await this.getActiveClient(userId, id);

    try {
      const client = await this.prisma.client.update({
        where: { id, userId, deletedAt: null },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.idNumber !== undefined && { idNumber: dto.idNumber }),
          ...(dto.phoneAlt !== undefined && { phoneAlt: dto.phoneAlt }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.latitude !== undefined && { latitude: dto.latitude }),
          ...(dto.longitude !== undefined && { longitude: dto.longitude }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      return { data: this.toClientResponse(client) };
    } catch (error) {
      this.throwIfDuplicateCi(error);
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    await this.getActiveClient(userId, id);
    await this.prisma.client.update({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { data: null, message: 'Client deleted successfully' };
  }

  private async getActiveClient(userId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  private toClientResponse(client: {
    id: string;
    fullName: string;
    phone: string;
    idNumber: string;
    phoneAlt: string | null;
    address: string | null;
    latitude: { toString(): string } | null;
    longitude: { toString(): string } | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      idNumber: client.idNumber,
      phoneAlt: client.phoneAlt,
      address: client.address,
      latitude: client.latitude ? this.decimalToNumber(client.latitude) : null,
      longitude: client.longitude
        ? this.decimalToNumber(client.longitude)
        : null,
      status: client.status,
      notes: client.notes,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  private decimalToNumber(value: { toString(): string }): number {
    return Number(value.toString());
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private throwIfDuplicateCi(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('ID number already exists');
    }
  }
}
