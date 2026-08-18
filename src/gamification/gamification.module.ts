import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationGateway } from './gamification.gateway';
import { Level } from './entities/level.entity';
import { UserXp } from './entities/user-xp.entity';
import { XpTransaction } from './entities/xp-transaction.entity';
import { GamificationConfig } from './entities/gamification-config.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoinsModule } from '../coins/coins.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Level, UserXp, XpTransaction, GamificationConfig]),
    NotificationsModule,
    forwardRef(() => CoinsModule),
    UsersModule,
  ],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationGateway],
  exports: [GamificationService, GamificationGateway],
})
export class GamificationModule {}
