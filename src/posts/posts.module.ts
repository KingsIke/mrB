import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CommentsController } from './comments.controller';
import { Post } from './entities/post.entity';
import { PostMedia } from './entities/post-media.entity';
import { PostTag } from './entities/post-tag.entity';
import { PostLike } from './entities/post-like.entity';
import { PostComment } from './entities/post-comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { PostReshare } from './entities/post-reshare.entity';
import { PostFavorite } from './entities/post-favorite.entity';
import { ContentReport } from './entities/content-report.entity';
import { PostView } from './entities/post-view.entity';
import { GiftTransaction } from '../gifts/entities/gift-transaction.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { FollowsModule } from '../follows/follows.module';
import { PostsGateway } from './posts.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      PostMedia,
      PostTag,
      PostLike,
      PostComment,
      CommentLike,
      PostReshare,
      PostFavorite,
      ContentReport,
      PostView,
      GiftTransaction,
    ]),
    UsersModule,
    NotificationsModule,
    GamificationModule,
    FollowsModule,
  ],
  controllers: [PostsController, CommentsController],
  providers: [PostsService, PostsGateway],
  exports: [PostsService, PostsGateway],
})
export class PostsModule {}
