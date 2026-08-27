import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreasureHuntService } from './treasure-hunt.service';
import { TreasureHuntController } from './treasure-hunt.controller';
import { TreasureHunt } from './entities/treasure-hunt.entity';
import { TreasureClaim } from './entities/treasure-claim.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { CoinsModule } from '../coins/coins.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TreasureHunt, TreasureClaim, Gift, User]),
    CoinsModule,
    NotificationsModule,
  ],
  controllers: [TreasureHuntController],
  providers: [TreasureHuntService],
  exports: [TreasureHuntService],
})
export class TreasureHuntModule {}
