import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// Excluye un endpoint de la protección del guard global JwtAuthGuard
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
