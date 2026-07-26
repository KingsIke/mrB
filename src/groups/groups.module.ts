import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GroupsService } from './groups.service';
import { MessagesService } from './messages.service';
import { GroupsController } from './groups.controller';
import { MessagesController } from './messages.controller';
import { GroupsGateway } from './groups.gateway';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupMessage } from './entities/group-message.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchoolsModule } from '../schools/schools.module';
import { FacultiesModule } from '../faculties/faculties.module';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMember, GroupMessage, MessageAttachment, MessageReaction]),
    UsersModule,
    NotificationsModule,
    SchoolsModule,
    FacultiesModule,
    DepartmentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [GroupsController, MessagesController],
  providers: [GroupsService, MessagesService, GroupsGateway],
  exports: [GroupsService, MessagesService, GroupsGateway],
})
export class GroupsModule {}
