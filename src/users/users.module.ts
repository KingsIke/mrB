import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersGateway } from './users.gateway';
import { StreamService } from './stream.service';
import { User } from './entities/user.entity';
import { Post } from 'src/posts/entities/post.entity';
import { Follow } from 'src/follows/entities/follow.entity';
import { PostLike } from 'src/posts/entities/post-like.entity';
import { GiftTransaction } from 'src/gifts/entities/gift-transaction.entity';
import { ContentReport } from 'src/posts/entities/content-report.entity';
import { UserSearchHistory } from './entities/user-search-history.entity';
import { UserXp } from 'src/gamification/entities/user-xp.entity';
import { Level } from 'src/gamification/entities/level.entity';
import { GamificationModule } from '../gamification/gamification.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Post, Follow, PostLike, GiftTransaction, ContentReport, UserSearchHistory, UserXp, Level]),
    forwardRef(() => GamificationModule),
    OtpModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersGateway, StreamService],
  exports: [UsersService, UsersGateway, StreamService],
})
export class UsersModule {}
