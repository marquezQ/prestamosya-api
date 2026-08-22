import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

/**
 * Módulo global: CloudinaryService queda disponible en toda la aplicación
 * sin necesidad de importar este módulo explícitamente en cada feature module.
 */
@Global()
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
