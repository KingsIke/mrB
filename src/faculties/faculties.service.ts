import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faculty } from './entities/faculty.entity';
import { SchoolsService } from '../schools/schools.service';

// Keep this list in sync with the keys of `departmentsByFaculty` in DepartmentsService.seedDepartments,
// since department seeding looks up departments by matching this exact faculty name.
const FACULTY_NAMES = [
  'Engineering',
  'Science',
  'Arts',
  'Social Sciences',
  'Law',
  'Management Sciences',
  'Education',
  'Agriculture',
  'Environmental Sciences',
  'Medicine and Health Sciences',
];

@Injectable()
export class FacultiesService {
  constructor(
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
    private readonly schoolsService: SchoolsService,
  ) {}

  async create(data: Partial<Faculty>): Promise<Faculty> {
    const faculty = this.facultyRepository.create(data);
    return this.facultyRepository.save(faculty);
  }

  async findAllBySchool(schoolId: string): Promise<Faculty[]> {
    return this.facultyRepository.find({
      where: { schoolId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findAll(): Promise<Faculty[]> {
    return this.facultyRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Faculty | null> {
    return this.facultyRepository.findOne({ where: { id } });
  }

  async seedFaculties(): Promise<void> {
    const count = await this.facultyRepository.count();
    if (count > 0) return;

    const schools = await this.schoolsService.findAll();

    for (const school of schools) {
      for (const name of FACULTY_NAMES) {
        const faculty = this.facultyRepository.create({ name, schoolId: school.id });
        await this.facultyRepository.save(faculty);
      }
    }
  }
}
