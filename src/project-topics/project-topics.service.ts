import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { ProjectTopic } from './entities/project-topic.entity';
import { ProjectTopicVote, VoteType } from './entities/project-topic-vote.entity';
import { CreateProjectTopicDto } from './dto/create-project-topic.dto';
import { ListProjectTopicsDto } from './dto/list-project-topics.dto';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import {
  PROJECT_TOPICS_BY_DEPARTMENT,
  DEFAULT_PROJECT_TOPICS,
} from '../database/data/project-topics.data';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProjectTopicWithVote extends ProjectTopic {
  userVote: 'up' | 'down' | null;
}

@Injectable()
export class ProjectTopicsService {
  constructor(
    @InjectRepository(ProjectTopic)
    private readonly ptRepo: Repository<ProjectTopic>,
    @InjectRepository(ProjectTopicVote)
    private readonly voteRepo: Repository<ProjectTopicVote>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Create ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateProjectTopicDto): Promise<ProjectTopic> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const pt = this.ptRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      course: dto.course ?? null,
      courseCode: dto.courseCode ?? null,
      level: dto.level ?? null,
      category: dto.category ?? null,
      tags: dto.tags ?? null,
      authorId: userId,
      departmentId: user.departmentId ?? null,
      facultyId: user.facultyId ?? null,
    });

    return this.ptRepo.save(pt);
  }

  // ── Seed ──────────────────────────────────────────────────────────

  /**
   * Seeds project topics into departments that have no topics yet.
   * Idempotent — skips departments that already have topics.
   */
  async seedProjectTopics(): Promise<{ created: number; skipped: number }> {
    // Find a system user to assign as author (the first active user)
    const systemUser = await this.userRepo.findOne({ where: { status: 'active' as any } });
    if (!systemUser) {
      throw new BadRequestException('No active users found to assign as topic author');
    }

    const departments = await this.deptRepo.find({ where: { isActive: true } });
    let created = 0;
    let skipped = 0;

    for (const dept of departments) {
      // Skip departments that already have topics
      const existingCount = await this.ptRepo.count({ where: { departmentId: dept.id } });
      if (existingCount > 0) {
        skipped++;
        continue;
      }

      // Find matching seed data by department name
      const seedTopics =
        PROJECT_TOPICS_BY_DEPARTMENT[dept.name] ?? DEFAULT_PROJECT_TOPICS;

      for (const seed of seedTopics) {
        const pt = this.ptRepo.create({
          title: seed.title,
          description: seed.description,
          course: seed.course ?? null,
          courseCode: seed.courseCode ?? null,
          level: seed.level ?? null,
          category: seed.category ?? null,
          tags: seed.tags ?? null,
          authorId: systemUser.id,
          departmentId: dept.id,
          facultyId: dept.facultyId ?? null,
        });
        await this.ptRepo.save(pt);
        created++;
      }
    }

    console.log(`Project topics seeded: ${created} created, ${skipped} departments skipped (already had topics)`);
    return { created, skipped };
  }

  // ── Read ──────────────────────────────────────────────────────────

  async findById(id: string, userId?: string): Promise<ProjectTopicWithVote> {
    const pt = await this.ptRepo.findOne({ where: { id } });
    if (!pt) throw new NotFoundException('Project topic not found');
    return this.attachUserVote(pt, userId);
  }

  /** List all project topics (paginated, with optional filters) */
  async list(dto: ListProjectTopicsDto, userId?: string): Promise<PaginatedResponse<ProjectTopicWithVote>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    return this.paginate(this.buildListQuery(dto), page, limit, userId);
  }

  /** List project topics in the current user's department */
  async listByDepartment(
    userId: string,
    dto: ListProjectTopicsDto,
  ): Promise<PaginatedResponse<ProjectTopicWithVote>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.departmentId) {
      throw new BadRequestException('User has no department assigned');
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    return this.paginate(this.buildListQuery(dto, user.departmentId), page, limit, userId);
  }

  // ── Update ────────────────────────────────────────────────────────

  async update(
    id: string,
    userId: string,
    dto: Partial<CreateProjectTopicDto>,
  ): Promise<ProjectTopic> {
    const pt = await this.findById(id);
    if (pt.authorId !== userId) {
      throw new BadRequestException('You can only edit your own project topics');
    }

    Object.assign(pt, {
      title: dto.title ?? pt.title,
      description: dto.description ?? pt.description,
      course: dto.course ?? pt.course,
      courseCode: dto.courseCode ?? pt.courseCode,
      level: dto.level ?? pt.level,
      category: dto.category ?? pt.category,
      tags: dto.tags ?? pt.tags,
    });

    return this.ptRepo.save(pt);
  }

  // ── Delete ────────────────────────────────────────────────────────

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const pt = await this.findById(id);
    if (pt.authorId !== userId) {
      throw new BadRequestException('You can only delete your own project topics');
    }
    await this.ptRepo.remove(pt);
    return { success: true };
  }

  // ── Voting (with tracking) ────────────────────────────────────────

  async upvote(
    userId: string,
    topicId: string,
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> {
    return this.toggleVote(userId, topicId, VoteType.UP);
  }

  async downvote(
    userId: string,
    topicId: string,
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> {
    return this.toggleVote(userId, topicId, VoteType.DOWN);
  }

  /**
   * Toggle vote logic:
   * - No existing vote → create new vote, increment counter
   * - Same vote type → remove vote, decrement counter (toggle off)
   * - Different vote type → switch vote, adjust both counters
   */
  private async toggleVote(
    userId: string,
    topicId: string,
    voteType: VoteType,
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> {
    const pt = await this.ptRepo.findOne({ where: { id: topicId } });
    if (!pt) throw new NotFoundException('Project topic not found');

    const existingVote = await this.voteRepo.findOne({
      where: { userId, topicId },
    });

    let newUserVote: 'up' | 'down' | null = null;

    await this.dataSource.transaction(async (manager) => {
      const topicRepo = manager.getRepository(ProjectTopic);
      const voteRepo = manager.getRepository(ProjectTopicVote);

      if (existingVote) {
        if (existingVote.type === voteType) {
          // Toggle off — remove the vote
          await voteRepo.remove(existingVote);
          if (voteType === VoteType.UP) {
            pt.upvotes = Math.max(0, pt.upvotes - 1);
          } else {
            pt.downvotes = Math.max(0, pt.downvotes - 1);
          }
          newUserVote = null;
        } else {
          // Switch vote — update the existing record
          existingVote.type = voteType;
          await voteRepo.save(existingVote);
          if (voteType === VoteType.UP) {
            pt.upvotes += 1;
            pt.downvotes = Math.max(0, pt.downvotes - 1);
          } else {
            pt.downvotes += 1;
            pt.upvotes = Math.max(0, pt.upvotes - 1);
          }
          newUserVote = voteType === VoteType.UP ? 'up' : 'down';
        }
      } else {
        // New vote — create and increment
        const vote = voteRepo.create({ userId, topicId, type: voteType });
        await voteRepo.save(vote);
        if (voteType === VoteType.UP) {
          pt.upvotes += 1;
        } else {
          pt.downvotes += 1;
        }
        newUserVote = voteType === VoteType.UP ? 'up' : 'down';
      }

      await topicRepo.save(pt);
    });

    return {
      upvotes: pt.upvotes,
      downvotes: pt.downvotes,
      userVote: newUserVote,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /** Fetch user's vote for a single topic */
  private async getUserVote(
    userId: string | undefined,
    topicId: string,
  ): Promise<'up' | 'down' | null> {
    if (!userId) return null;
    const vote = await this.voteRepo.findOne({
      where: { userId, topicId },
    });
    if (!vote) return null;
    return vote.type === VoteType.UP ? 'up' : 'down';
  }

  /** Attach userVote to a single topic */
  private async attachUserVote(
    pt: ProjectTopic,
    userId?: string,
  ): Promise<ProjectTopicWithVote> {
    const userVote = await this.getUserVote(userId, pt.id);
    return { ...pt, userVote };
  }

  /** Batch-fetch user votes for a list of topics */
  private async attachUserVotes(
    topics: ProjectTopic[],
    userId?: string,
  ): Promise<ProjectTopicWithVote[]> {
    if (!userId || topics.length === 0) {
      return topics.map((t) => ({ ...t, userVote: null }));
    }

    const topicIds = topics.map((t) => t.id);
    const votes = await this.voteRepo.find({
      where: topicIds.map((topicId) => ({ userId, topicId })),
    });

    const voteMap = new Map<string, VoteType>();
    votes.forEach((v) => voteMap.set(v.topicId, v.type));

    return topics.map((pt) => ({
      ...pt,
      userVote: voteMap.has(pt.id)
        ? voteMap.get(pt.id) === VoteType.UP
          ? 'up'
          : 'down'
        : null,
    }));
  }

  private buildListQuery(
    dto: ListProjectTopicsDto,
    departmentId?: string,
  ): SelectQueryBuilder<ProjectTopic> {
    const qb = this.ptRepo
      .createQueryBuilder('pt')
      .leftJoin('pt.author', 'author')
      .addSelect([
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.username',
        'author.profilePictureUrl',
      ]);

    if (departmentId) {
      qb.andWhere('pt.departmentId = :departmentId', { departmentId });
    }

    if (dto.level) {
      qb.andWhere('pt.level = :level', { level: dto.level });
    }

    if (dto.category) {
      qb.andWhere('pt.category = :category', { category: dto.category });
    }

    if (dto.course) {
      qb.andWhere(
        '(pt.course ILIKE :course OR pt.courseCode ILIKE :course)',
        { course: `%${dto.course}%` },
      );
    }

    if (dto.search) {
      qb.andWhere(
        '(pt.title ILIKE :search OR pt.description ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    qb.orderBy('pt.createdAt', 'DESC').addOrderBy('pt.id', 'DESC');
    return qb;
  }

  private async paginate(
    qb: SelectQueryBuilder<ProjectTopic>,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<PaginatedResponse<ProjectTopicWithVote>> {
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);
    const [items, total] = await qb.getManyAndCount();
    const itemsWithVotes = await this.attachUserVotes(items, userId);
    return {
      items: itemsWithVotes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
