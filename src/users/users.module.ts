import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Post } from 'src/posts/entities/post.entity';
import { Follow } from 'src/follows/entities/follow.entity';
import { PostLike } from 'src/posts/entities/post-like.entity';
import { GiftTransaction } from 'src/gifts/entities/gift-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post, Follow, PostLike, GiftTransaction])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
