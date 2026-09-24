import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WhotService } from './whot.service';
import { WhotController } from './whot.controller';
import { WhotGateway } from './whot.gateway';
import { WhotTable } from './entities/whot-table.entity';
import { WhotTablePlayer } from './entities/whot-table-player.entity';
import { User } from '../users/entities/user.entity';
import { CoinsModule } from '../coins/coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhotTable, WhotTablePlayer, User]),
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
  controllers: [WhotController],
  providers: [WhotService, WhotGateway],
  exports: [WhotService, WhotGateway],
})
export class WhotModule {}
