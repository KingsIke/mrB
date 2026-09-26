import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { FacultiesModule } from '../faculties/faculties.module';
import { DepartmentsModule } from '../departments/departments.module';
import { GamificationModule } from '../gamification/gamification.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TwoFactorSetupGuard } from './guards/two-factor-setup.guard';
import { TotpService } from './totp.service';
import { SchoolsModule } from 'src/schools/schools.module';
import { GroupsModule } from '../groups/groups.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [
    UsersModule,
    OtpModule,
    FacultiesModule,
    DepartmentsModule,
    GamificationModule,
    SchoolsModule,
    GroupsModule,
    TypeOrmModule.forFeature([RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  providers: [
    AuthService,
    RefreshTokenService,
    AccountDeletionService,
    TotpService,
    JwtStrategy,
    JwtAuthGuard,
    TwoFactorSetupGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, RefreshTokenService, JwtAuthGuard, TotpService],
})
export class AuthModule {}
