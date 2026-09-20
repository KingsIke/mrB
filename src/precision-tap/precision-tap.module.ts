import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrecisionTapService } from './precision-tap.service';
import { PrecisionTapController } from './precision-tap.controller';
import { PrecisionTapRound } from './entities/precision-tap-round.entity';
import { PrecisionTapDailyUsage } from './entities/precision-tap-daily-usage.entity';
import { User } from '../users/entities/user.entity';
import { CoinsModule } from '../coins/coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrecisionTapRound, PrecisionTapDailyUsage, User]),
    CoinsModule,
  ],
  controllers: [PrecisionTapController],
  providers: [PrecisionTapService],
  exports: [PrecisionTapService],
})
export class PrecisionTapModule {}
