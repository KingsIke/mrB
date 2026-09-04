import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CoinBattleService } from './coin-battle.service';
import { CoinBattleController } from './coin-battle.controller';
import { CoinBattleGateway } from './coin-battle.gateway';
import { CoinBattle } from './entities/coin-battle.entity';
import { CoinBattleAnswer } from './entities/coin-battle-answer.entity';
import { Question } from '../department-war/entities/question.entity';
import { User } from '../users/entities/user.entity';
import { CoinsModule } from '../coins/coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoinBattle, CoinBattleAnswer, Question, User]),
    CoinsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [CoinBattleController],
  providers: [CoinBattleService, CoinBattleGateway],
  exports: [CoinBattleService, CoinBattleGateway],
})
export class CoinBattleModule {}
