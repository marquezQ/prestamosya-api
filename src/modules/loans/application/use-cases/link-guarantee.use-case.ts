import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LinkGuaranteeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, loanId: string, guaranteeId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, client: { userId, deletedAt: null } },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const guarantee = await this.prisma.guarantee.findFirst({
      where: {
        id: guaranteeId,
        deletedAt: null,
        client: { userId, deletedAt: null },
      },
    });

    if (!guarantee) {
      throw new NotFoundException('Guarantee not found');
    }

    if (guarantee.clientId !== loan.clientId) {
      throw new BadRequestException(
        'Guarantee belongs to a different client than the borrower',
      );
    }

    if (guarantee.status === 'IN_USE') {
      throw new BadRequestException(
        'Guarantee is already IN_USE by another loan',
      );
    }

    const link = await this.prisma.$transaction(async (tx) => {
      await tx.guarantee.update({
        where: { id: guaranteeId },
        data: { status: 'IN_USE' },
      });

      return await tx.loanGuarantee.create({
        data: {
          loanId,
          guaranteeId,
          status: 'ACTIVE',
        },
        include: {
          guarantee: true,
        },
      });
    });

    return {
      id: link.id,
      loanId: link.loanId,
      guaranteeId: link.guaranteeId,
      status: link.status,
      guarantee: {
        id: link.guarantee.id,
        type: link.guarantee.type,
        description: link.guarantee.description,
        estimatedValue: link.guarantee.estimatedValue
          ? Number(link.guarantee.estimatedValue)
          : null,
        status: link.guarantee.status,
      },
    };
  }
}
