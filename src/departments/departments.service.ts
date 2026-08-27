import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { FacultiesService } from '../faculties/faculties.service';
import {
  DEPARTMENTS_BY_FACULTY,
  DEFAULT_DEPARTMENTS,
} from '../database/data/departments.data';

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

  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      relations: ['faculty'],
    });
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

  /**
   * Seeds departments for every faculty using the faculty's exact name as the
   * lookup key (falling back to DEFAULT_DEPARTMENTS for unknown names).
   * Idempotent: skips (facultyId, name) pairs that already exist.
   */
  async seedDepartments(): Promise<void> {
    const faculties = await this.facultiesService.findAll();

    const existing = await this.departmentRepository.find({
      select: ['id', 'facultyId', 'name'],
    });
    const existingKeys = new Set(
      existing.map((d) => `${d.facultyId}::${d.name.trim().toLowerCase()}`),
    );

    let created = 0;
    let skipped = 0;
    for (const faculty of faculties) {
      const names = [
        ...new Set(
          DEPARTMENTS_BY_FACULTY[faculty.name] || DEFAULT_DEPARTMENTS,
        ),
      ];
      for (const name of names) {
        const key = `${faculty.id}::${name.trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        await this.departmentRepository.save(
          this.departmentRepository.create({ name, facultyId: faculty.id }),
        );
        created++;
      }
    }

    console.log(
      `Departments seeded: ${created} created, ${skipped} already present`,
    );
  }
}
