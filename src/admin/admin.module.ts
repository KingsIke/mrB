import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { GiftTransaction } from '../gifts/entities/gift-transaction.entity';
import { Post } from '../posts/entities/post.entity';
import { Story } from '../stories/entities/story.entity';
import { CoinPurchase } from '../coins/entities/coin-purchase.entity';
import { CoinTransaction } from '../coins/entities/coin-transaction.entity';
import { PastQuestion } from '../past-questions/entities/past-question.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobApplication } from '../jobs/entities/job-application.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Gift,
      GiftTransaction,
      Post,
      Story,
      CoinPurchase,
      CoinTransaction,
      PastQuestion,
      Job,
      JobApplication,
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
