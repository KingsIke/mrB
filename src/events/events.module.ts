import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { User } from 'src/users/entities/user.entity';
import { School } from 'src/schools/entities/school.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, User, School]), CloudinaryModule, NotificationsModule, GamificationModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}