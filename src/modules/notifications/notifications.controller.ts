import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQuery } from './dto/list-notifications.query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  ApiListNotificationsDoc,
  ApiMarkAllAsReadDoc,
  ApiMarkAsReadDoc,
  ApiRegisterDeviceTokenDoc,
  ApiTriggerDailySummaryDoc,
  ApiUnreadCountDoc,
  ApiUnregisterDeviceTokenDoc,
} from './notifications.docs';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiListNotificationsDoc()
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notificationsService.listForUser(user.sub, query);
  }

  @Get('unread-count')
  @ApiUnreadCountDoc()
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch(':id/read')
  @ApiMarkAsReadDoc()
  markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  @Patch('read-all')
  @ApiMarkAllAsReadDoc()
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Post('device-tokens')
  @ApiRegisterDeviceTokenDoc()
  registerDeviceToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(
      user.sub,
      dto.token,
      dto.platform,
    );
  }

  @Delete('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiUnregisterDeviceTokenDoc()
  unregisterDeviceToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.unregisterDeviceToken(user.sub, dto.token);
  }

  @Post('trigger-daily-summary')
  @ApiTriggerDailySummaryDoc()
  triggerDailySummary(@CurrentUser() user: JwtPayload) {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Solo administradores pueden disparar esta acción',
      );
    }
    return this.notificationsService.sendDailySummaries();
  }
}
