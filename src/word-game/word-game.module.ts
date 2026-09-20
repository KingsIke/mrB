import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WordGameService } from './word-game.service';
import { WordGameController } from './word-game.controller';
import { WordGameAttempt } from './entities/word-game-attempt.entity';
import { WordGameStats } from './entities/word-game-stats.entity';
import { User } from '../users/entities/user.entity';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WordGameAttempt, WordGameStats, User]),
    GamificationModule,
  ],
  controllers: [WordGameController],
  providers: [WordGameService],
  exports: [WordGameService],
})
export class WordGameModule {}
