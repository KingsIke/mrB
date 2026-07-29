import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { OtpCode } from '../otp/entities/otp.entity';
import { School } from '../schools/entities/school.entity';
import { Faculty } from '../faculties/entities/faculty.entity';
import { Department } from '../departments/entities/department.entity';
import { Post } from '../posts/entities/post.entity';
import { PostMedia } from '../posts/entities/post-media.entity';
import { PostTag } from '../posts/entities/post-tag.entity';
import { PostLike } from '../posts/entities/post-like.entity';
import { PostComment } from '../posts/entities/post-comment.entity';
import { CommentLike } from '../posts/entities/comment-like.entity';
import { PostReshare } from '../posts/entities/post-reshare.entity';
import { PostFavorite } from '../posts/entities/post-favorite.entity';
import { ContentReport } from '../posts/entities/content-report.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Story } from '../stories/entities/story.entity';
import { StoryView } from '../stories/entities/story-view.entity';
import { StoryReaction } from '../stories/entities/story-reaction.entity';
import { StoryReply } from '../stories/entities/story-reply.entity';
import { Level } from '../gamification/entities/level.entity';
import { UserXp } from '../gamification/entities/user-xp.entity';
import { XpTransaction } from '../gamification/entities/xp-transaction.entity';
import { GamificationConfig } from '../gamification/entities/gamification-config.entity';
import { CoinBalance } from '../coins/entities/coin-balance.entity';
import { CoinTransaction } from '../coins/entities/coin-transaction.entity';
import { CoinPurchase } from '../coins/entities/coin-purchase.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { GiftTransaction } from '../gifts/entities/gift-transaction.entity';
import { Follow } from '../follows/entities/follow.entity';
import { UserBlock } from '../follows/entities/user-block.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { GroupMessage } from '../groups/entities/group-message.entity';
import { MessageAttachment } from '../groups/entities/message-attachment.entity';
import { MessageReaction } from '../groups/entities/message-reaction.entity';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DB_NAME', 'school_social_app'),
    entities: [
      User,
      OtpCode,
      School,
      Faculty,
      Department,
      Post,
      PostMedia,
      PostTag,
      PostLike,
      PostComment,
      CommentLike,
      PostReshare,
      PostFavorite,
      ContentReport,
      Notification,
      Story,
      StoryView,
      StoryReaction,
      StoryReply,
      Level,
      UserXp,
      XpTransaction,
      GamificationConfig,
      CoinBalance,
      CoinTransaction,
      CoinPurchase,
      Gift,
      GiftTransaction,
      Follow,
      UserBlock,
      Group,
      GroupMember,
      GroupMessage,
      MessageAttachment,
      MessageReaction,
    ],
    synchronize: configService.get('NODE_ENV') !== 'production',
    logging: configService.get('NODE_ENV') === 'development',
    migrations: ['dist/database/migrations/*{.ts,.js}'],
    migrationsRun: true,
  }),
};
