import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { SchoolsModule } from './schools/schools.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { FacultiesModule } from './faculties/faculties.module';
import { DepartmentsModule } from './departments/departments.module';
import { PostsModule } from './posts/posts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StoriesModule } from './stories/stories.module';
import { GamificationModule } from './gamification/gamification.module';
import { CoinsModule } from './coins/coins.module';
import { GiftsModule } from './gifts/gifts.module';
import { FollowsModule } from './follows/follows.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 10,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync(databaseConfig),
    CloudinaryModule,
    AuthModule,
    UsersModule,
    OtpModule,
    SchoolsModule,
    FacultiesModule,
    DepartmentsModule,
    PostsModule,
    NotificationsModule,
    StoriesModule,
    GamificationModule,
    CoinsModule,
    GiftsModule,
    FollowsModule,
    GroupsModule,
  ],
})
export class AppModule {}
