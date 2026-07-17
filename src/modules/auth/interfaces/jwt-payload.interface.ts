// Shape del payload que se firma en el JWT.
// En V1 no se usa 'rol' para permisos — es solo informativo en el token.
// En V2 se podrá usar con RolesGuard cuando se agregue el rol cobrador.
export interface JwtPayload {
  sub: string; // UUID del usuario (User.id)
  username: string;
  role: string; // 'admin' | 'collector' — valores del enum Role de Prisma
}
