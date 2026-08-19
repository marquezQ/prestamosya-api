import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuaranteeStatus, LoanStatus } from '../../generated/prisma/client';
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

    const clientIds = clients.map((client) => client.id);
    const activeCounts = await this.getActiveLoanCounts(clientIds);

    return {
      data: clients.map((client) => ({
        ...this.toClientResponse(client),
        activeLoanCount: activeCounts.get(client.id) ?? 0,
      })),
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const loanSummaries = client.loans.map((loan) => this.toLoanSummary(loan));

    return {
      data: {
        client: this.toClientResponse(client),
        activeLoans: loanSummaries.filter(
          (loan) => loan.status === LoanStatus.ACTIVE,
        ),
        completedLoans: loanSummaries.filter(
          (loan) => loan.status !== LoanStatus.ACTIVE,
        ),
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

  /**
   * Cuenta cuántos préstamos activos tiene cada cliente del listado.
   */
  private async getActiveLoanCounts(clientIds: string[]) {
    const counts = new Map<string, number>();

    if (clientIds.length === 0) {
      return counts;
    }

    const activeLoans = await this.prisma.loan.findMany({
      where: {
        clientId: { in: clientIds },
        status: LoanStatus.ACTIVE,
      },
      select: {
        clientId: true,
      },
    });

    for (const loan of activeLoans) {
      counts.set(loan.clientId, (counts.get(loan.clientId) ?? 0) + 1);
    }

    return counts;
  }

  private toLoanSummary(loan: {
    id: string;
    mode: string;
    capitalAmount: { toString(): string };
    currency: string;
    interestRate: { toString(): string };
    periodType: string | null;
    totalInstallments: number;
    totalAmount: { toString(): string };
    totalPaid: { toString(): string };
    outstandingBalance: { toString(): string };
    status: string;
    startDate: Date;
    createdAt: Date;
  }) {
    return {
      id: loan.id,
      currency: loan.currency,
      mode: loan.mode,
      capitalAmount: this.decimalToNumber(loan.capitalAmount),
      interestRate: this.decimalToNumber(loan.interestRate),
      periodType: loan.periodType,
      totalInstallments: loan.totalInstallments,
      totalAmount: this.decimalToNumber(loan.totalAmount),
      totalPaid: this.decimalToNumber(loan.totalPaid),
      outstandingBalance: this.decimalToNumber(loan.outstandingBalance),
      status: loan.status,
      startDate: loan.startDate,
      createdAt: loan.createdAt,
    };
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
