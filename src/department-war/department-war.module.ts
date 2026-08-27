import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DepartmentWarService } from './department-war.service';
import { DepartmentWarController } from './department-war.controller';
import { DepartmentWarGateway } from './department-war.gateway';
import { Question } from './entities/question.entity';
import { Battle } from './entities/battle.entity';
import { BattleAnswer } from './entities/battle-answer.entity';
import { DeptWarStats } from './entities/dept-war-stats.entity';
import { UserWarStats } from './entities/user-war-stats.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Battle, BattleAnswer, DeptWarStats, UserWarStats, User]),
    NotificationsModule,
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
  controllers: [DepartmentWarController],
  providers: [DepartmentWarService, DepartmentWarGateway],
  exports: [DepartmentWarService, DepartmentWarGateway],
})
export class DepartmentWarModule {}
