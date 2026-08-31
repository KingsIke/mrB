import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallHistory } from './entities/call-history.entity';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CallHistory])],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
