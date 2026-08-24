import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTopic } from './entities/project-topic.entity';
import { ProjectTopicVote } from './entities/project-topic-vote.entity';
import { ProjectTopicsService } from './project-topics.service';
import { ProjectTopicsController } from './project-topics.controller';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectTopic, ProjectTopicVote, User, Department]),
  ],
  providers: [ProjectTopicsService],
  controllers: [ProjectTopicsController],
  exports: [ProjectTopicsService],
})
export class ProjectTopicsModule {}
