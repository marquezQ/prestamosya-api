import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../../prisma/prisma.service';

// Estrategia de Passport para extraer, verificar la firma y decodificar el token JWT.
// validate() consulta la BD en cada request para garantizar que el usuario sigue
// activo y retorna el rol fresco (no el que quedó grabado en el JWT).
// Esto permite que desactivar un usuario o cambiarle el rol tenga efecto inmediato.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  // Valida el payload, verifica isActive en BD y retorna el payload con role fresco
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida o usuario desactivado');
    }

    // Retornar el payload con el role leído desde la BD (siempre fresco)
    return { ...payload, role: user.role };
  }
}
