import { Module } from '@nestjs/common';

/**
 * Módulo del panel de super administración.
 *
 * Agrupa todos los endpoints bajo /api/superadmin/*.
 * Todos sus controllers aplican @Roles('superadmin') — solo el dueño
 * de la plataforma puede acceder.
 *
 * Los controllers e imports se agregan progresivamente en las siguientes fases:
 *   - Fase 2: SuperAdminUsersController  (gestión de prestamistas)
 *   - Fase 3: SuperAdminViewsController  (ver carteras ajenas — solo lectura)
 *   - Fase 4: SuperAdminStatsController  (stats y dashboard por prestamista)
 *   - Fase 5: SuperAdminOverviewController (vista global de plataforma)
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class SuperAdminModule {}
