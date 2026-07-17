import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { Level } from './entities/level.entity';
import { UserXp } from './entities/user-xp.entity';
import { XpTransaction } from './entities/xp-transaction.entity';
import { GamificationConfig } from './entities/gamification-config.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoinsModule } from '../coins/coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Level, UserXp, XpTransaction, GamificationConfig]),
    NotificationsModule,
    CoinsModule,
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
