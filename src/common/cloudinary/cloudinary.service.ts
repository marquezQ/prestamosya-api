import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
// sharp exporta un default callable — con moduleResolution Node y CJS se importa así:
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp').default;

/** Dimensiones máximas de salida. Sharp mantiene la proporción automáticamente con fit:'inside'. */
const IMAGE_MAX_SIZE = 800;
const IMAGE_QUALITY = 80;

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
      api_key: process.env['CLOUDINARY_API_KEY'],
      api_secret: process.env['CLOUDINARY_API_SECRET'],
    });
  }

  /**
   * Optimiza un buffer de imagen (resize + conversión a WebP) y lo sube a Cloudinary.
   *
   * @param buffer   Buffer original de la imagen recibida del cliente.
   * @param folder   Carpeta destino dentro de Cloudinary (ej: "John Perez/garantias").
   * @returns        URL segura de la imagen subida.
   */
  async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    try {
      const optimized = await this.optimizeToWebp(buffer);
      const result = await this.uploadToCloudinary(optimized, folder);
      return result.secure_url;
    } catch (error) {
      this.logger.error(
        `Error al procesar o subir imagen a Cloudinary: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  // ─── Privados ──────────────────────────────────────────────────────────────

  /**
   * Redimensiona la imagen a máximo IMAGE_MAX_SIZE × IMAGE_MAX_SIZE conservando
   * la relación de aspecto (fit: 'inside'):
   *   - Foto horizontal → max 800px de ancho, alto proporcional
   *   - Foto vertical   → max 800px de alto, ancho proporcional
   * Nunca amplía imágenes ya más pequeñas. Convierte a WebP quality IMAGE_QUALITY.
   */
  private async optimizeToWebp(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width: IMAGE_MAX_SIZE,
        height: IMAGE_MAX_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();
  }

  /**
   * Sube un buffer a Cloudinary usando upload_stream (sin necesidad de
   * escribir el archivo en disco).
   */
  private uploadToCloudinary(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'webp',
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Error de Cloudinary SDK: ${error?.message ?? 'resultado vacío'}`,
            );
            reject(
              new InternalServerErrorException(
                `Error al subir imagen a Cloudinary: ${error?.message ?? 'resultado vacío'}`,
              ),
            );
            return;
          }
          resolve(result);
        },
      );

      stream.end(buffer);
    });
  }
}
