import { Controller, Get, Param, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushNotificationsService } from './push-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CursorPaginationDto } from '../common/pagination/cursor-pagination.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  async list(@CurrentUser('userId') userId: string, @Query() pagination: CursorPaginationDto) {
    return this.notificationsService.list(userId, pagination);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser('userId') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.notificationsService.markRead(userId, id);
    return { read: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser('userId') userId: string) {
    await this.notificationsService.markAllRead(userId);
    return { read: true };
  }

  // ============ PUSH TOKEN ============

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@CurrentUser('userId') userId: string) {
    const user = await this.notificationsService.getUserPreferences(userId);
    return user?.notificationPreferences ?? {
      pushEnabled: true,
      social: true,
      messages: true,
      gifts: true,
      system: true,
    };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() body: Record<string, boolean>,
  ) {
    return this.notificationsService.updateUserPreferences(userId, body);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Register or update Expo push token' })
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body() body: { pushToken: string },
  ) {
    return this.pushNotificationsService.registerToken(userId, body.pushToken);
  }

  @Post('push-token/unregister')
  @ApiOperation({ summary: 'Unregister push token (e.g. on logout)' })
  async unregisterPushToken(@CurrentUser('userId') userId: string) {
    return this.pushNotificationsService.unregisterToken(userId);
  }
}
