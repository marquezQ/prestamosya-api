import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
