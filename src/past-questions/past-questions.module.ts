import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PastQuestion } from './entities/past-question.entity';
import { PastQuestionsService } from './past-questions.service';
import { PastQuestionsController } from './past-questions.controller';
import { CoinsModule } from '../coins/coins.module';
import { CoinTransaction } from '../coins/entities/coin-transaction.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PastQuestion, CoinTransaction, User]),
    CoinsModule,
    NotificationsModule,
  ],
  providers: [PastQuestionsService],
  controllers: [PastQuestionsController],
  exports: [PastQuestionsService],
})
export class PastQuestionsModule {}
