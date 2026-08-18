import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GuaranteesController } from './guarantees.controller';
import { GuaranteesService } from './guarantees.service';

@Module({
  imports: [PrismaModule],
  controllers: [GuaranteesController],
  providers: [GuaranteesService],
  exports: [GuaranteesService],
})
export class GuaranteesModule {}
