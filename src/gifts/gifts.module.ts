import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftsService } from './gifts.service';
import { GiftsController } from './gifts.controller';
import { Gift } from './entities/gift.entity';
import { GiftTransaction } from './entities/gift-transaction.entity';
import { CoinsModule } from '../coins/coins.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { StoriesModule } from '../stories/stories.module';
import { FollowsModule } from '../follows/follows.module';
import { GroupsModule } from '../groups/groups.module';
import { GroupMember } from '../groups/entities/group-member.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gift, GiftTransaction, GroupMember, User]),
    CoinsModule,
    GamificationModule,
    NotificationsModule,
    PostsModule,
    StoriesModule,
    FollowsModule,
    GroupsModule,
  ],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}
