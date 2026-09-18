// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Módulo de AUTENTICACIÓN (auth = "quién soy", no "qué hago con mi cuenta").
 *
 * Contiene: login/logout/me, estrategias JWT, guards y decoradores de
 * seguridad. La CUENTA del usuario (perfil, contraseña) vive en UsersModule
 * y la configuración del negocio en BusinessConfigModule.
 */
@Module({
  imports: [
    // Configuración base de Passport para JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Configuración dinámica del JWT leyendo del archivo .env
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  // Se exportan para que AppModule pueda registrar el guard globalmente
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
