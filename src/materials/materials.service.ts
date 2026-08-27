import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampusMaterial, MaterialCategory } from './entities/campus-material.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Faculty } from '../faculties/entities/faculty.entity';
import { Department } from '../departments/entities/department.entity';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(CampusMaterial)
    private readonly materialRepo: Repository<CampusMaterial>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  // ── User-facing ───────────────────────────────────────────────

  /**
   * List materials by category, filtered by the user's department.
   * Falls back to school-wide if the user has no department set.
   */
  async listByCategory(userId: string, category: MaterialCategory) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const qb = this.materialRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.uploader', 'uploader')
      .where('m.category = :category', { category })
      .andWhere('m.isActive = true');

    // Filter by department if available, otherwise by school
    if (user.departmentId) {
      qb.andWhere('m.departmentId = :deptId', { deptId: user.departmentId });
    } else if (user.schoolId) {
      qb.andWhere('m.schoolId = :schoolId', { schoolId: user.schoolId });
    }

    qb.orderBy('m.createdAt', 'DESC');

    const items = await qb.getMany();

    return items.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      course: m.course,
      courseCode: m.courseCode,
      level: m.level,
      author: m.author,
      isbn: m.isbn,
      dueDate: m.dueDate,
      labSession: m.labSession,
      files: m.files,
      coverImage: m.coverImage,
      externalLink: m.externalLink,
      priceCoins: m.priceCoins,
      downloadsCount: m.downloadsCount,
      createdAt: m.createdAt,
      uploader: m.uploader
        ? {
            id: m.uploader.id,
            firstName: m.uploader.firstName,
            lastName: m.uploader.lastName,
            username: m.uploader.username,
          }
        : null,
    }));
  }

  // ── Admin-facing ──────────────────────────────────────────────

  async adminList(category?: MaterialCategory) {
    const where: any = {};
    if (category) where.category = category;

    return this.materialRepo.find({
      where,
      relations: ['uploader'],
      order: { createdAt: 'DESC' },
    });
  }

  async adminGetById(id: string) {
    const material = await this.materialRepo.findOne({
      where: { id },
      relations: ['uploader'],
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async adminCreate(dto: CreateMaterialDto, adminId: string) {
    const materialData = {
      title: dto.title,
      description: dto.description ?? undefined,
      category: dto.category,
      course: dto.course ?? undefined,
      courseCode: dto.courseCode ?? undefined,
      level: dto.level ?? undefined,
      author: dto.author ?? undefined,
      isbn: dto.isbn ?? undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      labSession: dto.labSession ?? undefined,
      files: dto.files ?? undefined,
      coverImage: dto.coverImage ?? undefined,
      externalLink: dto.externalLink ?? undefined,
      priceCoins: dto.priceCoins ?? 0,
      uploaderId: adminId,
      departmentId: (dto as any).departmentId || undefined,
      isActive: true,
    };

    const material = this.materialRepo.create(materialData);

    return this.materialRepo.save(material);
  }

  async adminUpdate(id: string, dto: Partial<CreateMaterialDto>) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');

    if (dto.title !== undefined) material.title = dto.title;
    if (dto.description !== undefined) material.description = dto.description;
    if (dto.course !== undefined) material.course = dto.course;
    if (dto.courseCode !== undefined) material.courseCode = dto.courseCode;
    if (dto.level !== undefined) material.level = dto.level;
    if (dto.author !== undefined) material.author = dto.author;
    if (dto.isbn !== undefined) material.isbn = dto.isbn;
    if (dto.dueDate !== undefined) material.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.labSession !== undefined) material.labSession = dto.labSession;
    if (dto.files !== undefined) material.files = dto.files;
    if (dto.coverImage !== undefined) material.coverImage = dto.coverImage;
    if (dto.externalLink !== undefined) material.externalLink = dto.externalLink;
    if (dto.priceCoins !== undefined) material.priceCoins = dto.priceCoins;

    return this.materialRepo.save(material);
  }

  async adminDelete(id: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    await this.materialRepo.remove(material);
  }

  async adminDeleteMany(ids: string[]) {
    const deleted: string[] = [];
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.adminDelete(id);
        deleted.push(id);
      } catch {
        errors.push(id);
      }
    }
    return { deleted, errors };
  }

  async adminToggleActive(id: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    material.isActive = !material.isActive;
    return this.materialRepo.save(material);
  }

  // ── Seed ─────────────────────────────────────────────────────

  async seedDemoMaterials(): Promise<{ created: number; schoolId: string; departmentId: string }> {
    // 1. Find or create Covenant University
    let school = await this.schoolRepo.findOne({ where: { name: 'Covenant University' } });
    if (!school) {
      school = this.schoolRepo.create({ name: 'Covenant University', shortName: 'CU', type: 'university', city: 'Ota', state: 'Ogun' });
      school = await this.schoolRepo.save(school);
    }

    // 2. Find or create Faculty of Science
    let faculty = await this.facultyRepo.findOne({ where: { name: 'Faculty of Science', schoolId: school.id } });
    if (!faculty) {
      faculty = this.facultyRepo.create({ name: 'Faculty of Science', schoolId: school.id });
      faculty = await this.facultyRepo.save(faculty);
    }

    // 3. Find or create Animal Science department
    let dept = await this.departmentRepo.findOne({ where: { name: 'Animal Science', facultyId: faculty.id } });
    if (!dept) {
      dept = this.departmentRepo.create({ name: 'Animal Science', facultyId: faculty.id, isActive: true });
      dept = await this.departmentRepo.save(dept);
    }

    // 4. Use any user as uploader
    const uploader = await this.userRepo.findOne({ where: {} });
    const uploaderId = uploader?.id;

    // 5. Seed materials
    const seeds: Partial<CampusMaterial>[] = [
      // Lecture Notes
      { title: 'Animal Nutrition Lecture Notes', description: 'Comprehensive notes on animal feed and nutrition', category: MaterialCategory.LECTURE_NOTES, course: 'Animal Nutrition', courseCode: 'ANS301', level: '300', priceCoins: 0, departmentId: dept.id, schoolId: school.id },
      { title: 'Livestock Production Management', description: 'Notes covering all aspects of livestock management', category: MaterialCategory.LECTURE_NOTES, course: 'Livestock Production', courseCode: 'ANS401', level: '400', priceCoins: 0, departmentId: dept.id, schoolId: school.id },
      { title: 'Animal Physiology Notes', description: 'Detailed animal physiology lecture notes', category: MaterialCategory.LECTURE_NOTES, course: 'Animal Physiology', courseCode: 'ANS201', level: '200', priceCoins: 0, departmentId: dept.id, schoolId: school.id },

      // Textbooks
      { title: 'Animal Science and Production', description: 'A comprehensive textbook on animal production systems', category: MaterialCategory.TEXTBOOKS, course: 'Animal Production', courseCode: 'ANS301', level: '300', author: 'Michael K. use', isbn: '978-0123456789', priceCoins: 50, departmentId: dept.id, schoolId: school.id },
      { title: 'Principles of Animal Breeding', description: 'Textbook covering genetics and animal breeding principles', category: MaterialCategory.TEXTBOOKS, course: 'Animal Breeding', courseCode: 'ANS401', level: '400', author: 'James P. Lyons', isbn: '978-0987654321', priceCoins: 80, departmentId: dept.id, schoolId: school.id },

      // Assignments
      { title: 'ANS301 Assignment 1 - Feed Formulation', description: 'Practical assignment on compound feed formulation', category: MaterialCategory.ASSIGNMENTS, course: 'Animal Nutrition', courseCode: 'ANS301', level: '300', dueDate: new Date('2026-09-15'), priceCoins: 0, departmentId: dept.id, schoolId: school.id },
      { title: 'ANS401 Assignment 2 - Herd Management', description: 'Case study on small ruminant herd management', category: MaterialCategory.ASSIGNMENTS, course: 'Livestock Production', courseCode: 'ANS401', level: '400', dueDate: new Date('2026-09-20'), priceCoins: 0, departmentId: dept.id, schoolId: school.id },

      // Practicals
      { title: 'ANP201 Practical - Rumen Content Analysis', description: 'Lab practical on rumen fluid analysis techniques', category: MaterialCategory.PRACTICALS, course: 'Animal Physiology', courseCode: 'ANP201', level: '200', labSession: 'Lab 3, Tuesday 2pm', priceCoins: 0, departmentId: dept.id, schoolId: school.id },
      { title: 'ANS301 Practical - Artificial Insemination', description: 'Hands-on AI practical session', category: MaterialCategory.PRACTICALS, course: 'Animal Breeding', courseCode: 'ANS301', level: '300', labSession: 'Vet Lab, Thursday 10am', priceCoins: 0, departmentId: dept.id, schoolId: school.id },

      // Courses
      { title: 'B.Sc. Animal Science Programme', description: 'Full course outline for B.Sc. Animal Science at Covenant University', category: MaterialCategory.COURSES, course: 'Animal Science', courseCode: 'ANS', level: '100-400', priceCoins: 0, departmentId: dept.id, schoolId: school.id },
      { title: 'ANS300 Level Courses Overview', description: 'Overview of all 300-level Animal Science courses', category: MaterialCategory.COURSES, course: 'Animal Science', courseCode: 'ANS3XX', level: '300', priceCoins: 0, departmentId: dept.id, schoolId: school.id },
    ];

    let created = 0;
    for (const seed of seeds) {
      const exists = await this.materialRepo.findOne({ where: { title: seed.title } });
      if (!exists) {
        const m = this.materialRepo.create({
          ...seed,
          uploaderId,
          isActive: true,
          downloadsCount: 0,
        } as any);
        await this.materialRepo.save(m);
        created++;
      }
    }

    return { created, schoolId: school.id, departmentId: dept.id };
  }
}
