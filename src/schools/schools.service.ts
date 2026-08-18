import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { NIGERIAN_INSTITUTIONS } from '../database/data/schools.data';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
  ) {}

  async create(data: Partial<School>): Promise<School> {
    const school = this.schoolRepository.create(data);
    return this.schoolRepository.save(school);
  }

  async findAll(type?: string): Promise<School[]> {
    return this.schoolRepository.find({
      where: {
        isActive: true,
        ...(type ? { type } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<School | null> {
    return this.schoolRepository.findOne({ where: { id } });
  }

  /**
   * Seeds the full accredited Nigerian institutions list. Idempotent: inserts
   * only schools whose name is not already present, and backfills `type` on
   * legacy rows (the old seed only contained universities).
   */
  async seedSchools(): Promise<void> {
    const existing = await this.schoolRepository.find({
      select: ['id', 'name', 'type'],
    });
    const existingByName = new Map(
      existing.map((s) => [s.name.trim().toLowerCase(), s]),
    );

    let created = 0;
    let updated = 0;
    for (const data of NIGERIAN_INSTITUTIONS) {
      const row = existingByName.get(data.name.trim().toLowerCase());
      if (row) {
        if (!row.type) {
          await this.schoolRepository.update(row.id, { type: data.type });
          updated++;
        }
        continue;
      }
      await this.schoolRepository.save(
        this.schoolRepository.create({
          ...data,
          country: data.country || 'Nigeria',
        }),
      );
      created++;
    }

    console.log(
      `Schools seeded: ${created} inserted, ${updated} type-backfilled, ${existing.length} already present`,
    );
  }
}
