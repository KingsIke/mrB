import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersGateway } from './users.gateway';
import { User } from './entities/user.entity';
import { Post } from 'src/posts/entities/post.entity';
import { Follow } from 'src/follows/entities/follow.entity';
import { PostLike } from 'src/posts/entities/post-like.entity';
import { GiftTransaction } from 'src/gifts/entities/gift-transaction.entity';
import { UserSearchHistory } from './entities/user-search-history.entity';
import { UserXp } from 'src/gamification/entities/user-xp.entity';
import { Level } from 'src/gamification/entities/level.entity';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Post, Follow, PostLike, GiftTransaction, UserSearchHistory, UserXp, Level]),
    forwardRef(() => GamificationModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersGateway],
  exports: [UsersService, UsersGateway],
})
export class UsersModule {}
