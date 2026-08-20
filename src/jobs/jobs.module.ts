import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { JobApplication } from './entities/job-application.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, JobApplication, User, School]),
    NotificationsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
