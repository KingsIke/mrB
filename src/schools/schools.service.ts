import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';

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

  async findAll(): Promise<School[]> {
    return this.schoolRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<School | null> {
    return this.schoolRepository.findOne({ where: { id } });
  }

  async seedSchools(): Promise<void> {
    const count = await this.schoolRepository.count();
    if (count > 0) return;

    const schools = [
      {
        name: 'University of Lagos',
        shortName: 'UNILAG',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        website: 'https://unilag.edu.ng',
      },
      {
        name: 'University of Ibadan',
        shortName: 'UI',
        city: 'Ibadan',
        state: 'Oyo',
        country: 'Nigeria',
        website: 'https://ui.edu.ng',
      },
      {
        name: 'Obafemi Awolowo University',
        shortName: 'OAU',
        city: 'Ife',
        state: 'Osun',
        country: 'Nigeria',
        website: 'https://oauife.edu.ng',
      },
      {
        name: 'University of Nigeria, Nsukka',
        shortName: 'UNN',
        city: 'Nsukka',
        state: 'Enugu',
        country: 'Nigeria',
        website: 'https://unn.edu.ng',
      },
      {
        name: 'Ahmadu Bello University',
        shortName: 'ABU',
        city: 'Zaria',
        state: 'Kaduna',
        country: 'Nigeria',
        website: 'https://abu.edu.ng',
      },
      {
        name: 'Covenant University',
        shortName: 'CU',
        city: 'Ota',
        state: 'Ogun',
        country: 'Nigeria',
        website: 'https://covenantuniversity.edu.ng',
      },
      {
        name: 'Federal University of Technology, Akure',
        shortName: 'FUTA',
        city: 'Akure',
        state: 'Ondo',
        country: 'Nigeria',
        website: 'https://futa.edu.ng',
      },
      {
        name: 'University of Benin',
        shortName: 'UNIBEN',
        city: 'Benin City',
        state: 'Edo',
        country: 'Nigeria',
        website: 'https://uniben.edu.ng',
      },
    ];

    for (const schoolData of schools) {
      const school = this.schoolRepository.create(schoolData);
      await this.schoolRepository.save(school);
    }
  }
}
