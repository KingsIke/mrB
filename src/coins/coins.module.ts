import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoinsService } from './coins.service';
import { CoinsController } from './coins.controller';
import { PaystackClient } from './paystack.client';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinTransaction } from './entities/coin-transaction.entity';
import { CoinPurchase } from './entities/coin-purchase.entity';
import { SavedWithdrawalAccount } from './entities/saved-withdrawal-account.entity';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from 'src/gamification/gamification.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoinBalance, CoinTransaction, CoinPurchase, SavedWithdrawalAccount]),
    forwardRef(() => GamificationModule),
    forwardRef(() => UsersModule),
    OtpModule,
  ],
  controllers: [CoinsController],
  providers: [CoinsService, PaystackClient],
  exports: [CoinsService],
})
export class CoinsModule {}