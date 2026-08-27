import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampusMaterial } from './entities/campus-material.entity';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Faculty } from '../faculties/entities/faculty.entity';
import { Department } from '../departments/entities/department.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CampusMaterial, User, School, Faculty, Department])],
  providers: [MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsService],
})
export class MaterialsModule {}
