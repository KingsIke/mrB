import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PuzzleService } from './puzzle.service';
import { PuzzleController } from './puzzle.controller';
import { PuzzleScore } from './entities/puzzle-score.entity';
import { User } from '../users/entities/user.entity';
import { GamificationModule } from '../gamification/gamification.module';
import { CoinsModule } from '../coins/coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PuzzleScore, User]),
    GamificationModule,
    CoinsModule,
  ],
  controllers: [PuzzleController],
  providers: [PuzzleService],
  exports: [PuzzleService],
})
export class PuzzleModule {}
