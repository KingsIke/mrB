import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { OtpCode } from './entities/otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
