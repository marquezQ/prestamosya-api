import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessConfigModule } from './modules/business-config/business-config.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LoansModule } from './modules/loans/loans.module';
import { GuaranteesModule } from './modules/guarantees/guarantees.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CronModule } from './modules/cron/cron.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StatsModule } from './modules/stats/stats.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SuperAdminModule } from './modules/superadmin/superadmin.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    BusinessConfigModule,
    ClientsModule,
    LoansModule,
    GuaranteesModule,
    PaymentsModule,
    CronModule,
    DashboardModule,
    StatsModule,
    NotificationsModule,
    SuperAdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard 1 — Autenticación: toda ruta es protegida por defecto.
    // Usar @Public() para rutas públicas (ej: POST /auth/login).
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Guard 2 — Autorización por rol: solo actúa si la ruta tiene @Roles().
    // Si no hay @Roles(), pasa sin restricción → todos los endpoints existentes
    // siguen funcionando exactamente igual para usuarios con role='admin'.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
