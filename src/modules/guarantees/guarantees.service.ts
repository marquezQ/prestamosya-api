import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeDto } from './dto/update-guarantee.dto';
import { Guarantee } from '../../generated/prisma/client';

@Injectable()
export class GuaranteesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGuaranteeDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const guarantee = await this.prisma.guarantee.create({
      data: {
        clientId: dto.clientId,
        type: dto.type,
        description: dto.description,
        estimatedValue: dto.estimatedValue
          ? dto.estimatedValue.toString()
          : null,
      },
    });

    return this.formatGuarantee(guarantee);
  }

  async findByClient(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const guarantees = await this.prisma.guarantee.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return guarantees.map((g) => this.formatGuarantee(g));
  }

  async findOne(userId: string, id: string) {
    const guarantee = await this.prisma.guarantee.findFirst({
      where: {
        id,
        deletedAt: null,
        client: { userId, deletedAt: null },
      },
    });

    if (!guarantee) {
      throw new NotFoundException('Guarantee not found');
    }

    return this.formatGuarantee(guarantee);
  }

  async update(userId: string, id: string, dto: UpdateGuaranteeDto) {
    await this.findOne(userId, id); // Verify ownership

    const updated = await this.prisma.guarantee.update({
      where: { id },
      data: {
        type: dto.type,
        description: dto.description,
        estimatedValue:
          dto.estimatedValue !== undefined
            ? dto.estimatedValue !== null
              ? dto.estimatedValue.toString()
              : null
            : undefined,
      },
    });

    return this.formatGuarantee(updated);
  }

  async remove(userId: string, id: string) {
    const guarantee = await this.prisma.guarantee.findFirst({
      where: {
        id,
        deletedAt: null,
        client: { userId, deletedAt: null },
      },
    });

    if (!guarantee) {
      throw new NotFoundException('Guarantee not found');
    }

    if (guarantee.status === 'IN_USE') {
      throw new BadRequestException(
        'Cannot delete a guarantee that is currently IN_USE',
      );
    }

    await this.prisma.guarantee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Guarantee deleted successfully' };
  }

  private formatGuarantee(g: Guarantee) {
    return {
      id: g.id,
      clientId: g.clientId,
      type: g.type,
      description: g.description,
      estimatedValue: g.estimatedValue ? Number(g.estimatedValue) : null,
      status: g.status,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
}
