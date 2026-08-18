import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faculty } from './entities/faculty.entity';
import { SchoolsService } from '../schools/schools.service';
import { getFacultiesForSchool } from '../database/data/faculties.data';
import type { InstitutionType } from '../database/data/schools.data';

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

  /**
   * Seeds the real faculty/school structure for every institution, keyed off
   * the school's `type` (and shortName for well-known universities). Idempotent:
   * skips (schoolId, name) pairs that already exist.
   */
  async seedFaculties(): Promise<void> {
    const schools = await this.schoolsService.findAll();

    const existing = await this.facultyRepository.find({
      select: ['id', 'schoolId', 'name'],
    });
    const existingKeys = new Set(
      existing.map((f) => `${f.schoolId}::${f.name.trim().toLowerCase()}`),
    );

    let created = 0;
    let skipped = 0;
    for (const school of schools) {
      const type = (school.type as InstitutionType) || 'university';
      const names = getFacultiesForSchool(school.shortName, type);
      for (const name of names) {
        const key = `${school.id}::${name.trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        await this.facultyRepository.save(
          this.facultyRepository.create({ name, schoolId: school.id }),
        );
        created++;
      }
    }

    console.log(
      `Faculties seeded: ${created} created, ${skipped} already present`,
    );
  }
}
