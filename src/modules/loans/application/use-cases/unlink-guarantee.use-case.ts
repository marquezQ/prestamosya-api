import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class UnlinkGuaranteeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, loanId: string, guaranteeId: string) {
    const link = await this.prisma.loanGuarantee.findFirst({
      where: {
        loanId,
        guaranteeId,
        status: 'ACTIVE',
        loan: { client: { userId, deletedAt: null } },
      },
    });

    if (!link) {
      throw new NotFoundException(
        'Active guarantee link not found for this loan',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.loanGuarantee.update({
        where: { id: link.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      await tx.guarantee.update({
        where: { id: guaranteeId },
        data: {
          status: 'AVAILABLE',
        },
      });
    });

    return { message: 'Guarantee unlinked successfully' };
  }
}
