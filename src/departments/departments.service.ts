import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { FacultiesService } from '../faculties/faculties.service';

// Keys must match the faculty names in FacultiesService's FACULTY_NAMES exactly,
// since seeding looks up this map by each faculty's `name`.
const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  Engineering: [
    'Mechanical Engineering',
    'Electrical/Electronic Engineering',
    'Civil Engineering',
    'Computer Engineering',
    'Chemical Engineering',
  ],
  Science: ['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Microbiology'],
  Arts: ['English', 'History', 'Linguistics', 'Philosophy', 'Theatre Arts'],
  'Social Sciences': ['Economics', 'Political Science', 'Sociology', 'Psychology', 'Mass Communication'],
  Law: ['Law'],
  'Management Sciences': ['Accounting', 'Business Administration', 'Banking and Finance', 'Marketing'],
  Education: ['Educational Administration', 'Curriculum Studies', 'Guidance and Counselling'],
  Agriculture: ['Agricultural Economics', 'Animal Science', 'Crop Science', 'Soil Science'],
  'Environmental Sciences': [
    'Architecture',
    'Urban and Regional Planning',
    'Estate Management',
    'Surveying and Geoinformatics',
  ],
  'Medicine and Health Sciences': [
    'Medicine and Surgery',
    'Nursing Science',
    'Pharmacy',
    'Physiology',
    'Anatomy',
  ],
};

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly facultiesService: FacultiesService,
  ) {}

  async create(data: Partial<Department>): Promise<Department> {
    const department = this.departmentRepository.create(data);
    return this.departmentRepository.save(department);
  }

  async findAllByFaculty(facultyId: string): Promise<Department[]> {
    return this.departmentRepository.find({
      where: { facultyId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Department | null> {
    return this.departmentRepository.findOne({ where: { id } });
  }

  async seedDepartments(): Promise<void> {
    const count = await this.departmentRepository.count();
    if (count > 0) return;

    const faculties = await this.facultiesService.findAll();

    for (const faculty of faculties) {
      const departmentNames = DEPARTMENTS_BY_FACULTY[faculty.name] || [];
      for (const name of departmentNames) {
        const department = this.departmentRepository.create({ name, facultyId: faculty.id });
        await this.departmentRepository.save(department);
      }
    }
  }
}
