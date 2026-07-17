import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { Follow } from './entities/follow.entity';
import { UserBlock } from './entities/user-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, UserBlock])],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
