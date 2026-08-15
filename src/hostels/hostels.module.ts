import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostelsController } from './hostels.controller';
import { HostelsService } from './hostels.service';
import { HostelListing } from './entities/hostel-listing.entity';
import { HostelLike } from './entities/hostel-like.entity';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { School } from 'src/schools/entities/school.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HostelListing, HostelLike, School, User]),
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [HostelsController],
  providers: [HostelsService],
  exports: [HostelsService],
})
export class HostelsModule {}
