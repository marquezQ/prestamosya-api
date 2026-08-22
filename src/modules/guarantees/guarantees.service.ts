import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeDto } from './dto/update-guarantee.dto';
import { Guarantee, GuaranteePhoto } from '../../generated/prisma/client';

/** Carpeta base en Cloudinary. Estructura: {name}/garantias/ */
const CLOUDINARY_BASE_FOLDER = 'garantias';

@Injectable()
export class GuaranteesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(
    userId: string,
    name: string,
    dto: CreateGuaranteeDto,
    imageBuffer?: Buffer,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Si viene imagen, subirla a Cloudinary antes de la transacción BD
    const imageUrl = imageBuffer
      ? await this.uploadGuaranteeImage(imageBuffer, name)
      : null;

    const guarantee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.guarantee.create({
        data: {
          clientId: dto.clientId,
          type: dto.type,
          description: dto.description,
          estimatedValue: dto.estimatedValue
            ? dto.estimatedValue.toString()
            : null,
        },
      });

      if (imageUrl) {
        await tx.guaranteePhoto.create({
          data: { guaranteeId: created.id, fileUrl: imageUrl },
        });
      }

      return tx.guarantee.findUnique({
        where: { id: created.id },
        include: { photos: true },
      });
    });

    return this.formatGuarantee(guarantee!);
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
      include: { photos: true },
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
      include: { photos: true },
    });

    if (!guarantee) {
      throw new NotFoundException('Guarantee not found');
    }

    return this.formatGuarantee(guarantee);
  }

  async update(
    userId: string,
    name: string,
    id: string,
    dto: UpdateGuaranteeDto,
    imageBuffer?: Buffer,
  ) {
    const existing = await this.prisma.guarantee.findFirst({
      where: {
        id,
        deletedAt: null,
        client: { userId, deletedAt: null },
      },
      include: { photos: true },
    });

    if (!existing) {
      throw new NotFoundException('Guarantee not found');
    }

    const imageUrl = imageBuffer
      ? await this.uploadGuaranteeImage(imageBuffer, name)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.guarantee.update({
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

      if (imageUrl) {
        const [existingPhoto] = existing.photos;

        if (existingPhoto) {
          await tx.guaranteePhoto.update({
            where: { id: existingPhoto.id },
            data: { fileUrl: imageUrl },
          });
        } else {
          await tx.guaranteePhoto.create({
            data: { guaranteeId: id, fileUrl: imageUrl },
          });
        }
      }

      return tx.guarantee.findUnique({
        where: { id },
        include: { photos: true },
      });
    });

    return this.formatGuarantee(updated!);
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

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private uploadGuaranteeImage(buffer: Buffer, name: string): Promise<string> {
    const folder = `${name}/${CLOUDINARY_BASE_FOLDER}`;
    return this.cloudinary.uploadImage(buffer, folder);
  }

  private formatGuarantee(g: Guarantee & { photos: GuaranteePhoto[] }) {
    const firstPhoto = g.photos[0];
    return {
      id: g.id,
      clientId: g.clientId,
      type: g.type,
      description: g.description,
      estimatedValue: g.estimatedValue ? Number(g.estimatedValue) : null,
      status: g.status,
      imageUrl: firstPhoto ? firstPhoto.fileUrl : null,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
}
