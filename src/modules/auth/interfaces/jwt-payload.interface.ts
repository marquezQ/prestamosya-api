// Shape del payload que se firma en el JWT.
// El campo `role` se lee fresco desde la BD en cada request (JwtStrategy.validate()),
// por lo que siempre refleja el rol actual aunque el token sea antiguo.
export interface JwtPayload {
  sub: string; // UUID del usuario (User.id)
  name: string; // Nombre completo del usuario (User.name)
  username: string;
  role: string; // 'admin' | 'superadmin' — valores del enum Role de Prisma
  // Nota: 'collector' existe en el enum de BD pero no se usa en el panel aún (DT-04).
}
