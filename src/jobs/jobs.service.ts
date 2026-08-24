import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus, JobType } from './entities/job.entity';
import { JobApplication, ApplicationStatus } from './entities/job-application.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationTargetType } from '../notifications/entities/notification.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobApplication)
    private readonly appRepo: Repository<JobApplication>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: any): Promise<Job> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const job = this.jobRepo.create({
      ...dto,
      postedById: userId,
      schoolId: user.schoolId,
      status: JobStatus.OPEN,
      applicationsCount: 0,
    } as Partial<Job>);

    return this.jobRepo.save(job);
  }

  async findAll(query: {
    q?: string;
    type?: string;
    status?: string;
    schoolId?: string;
    page?: number;
    limit?: number;
  }) {
    const { q, type, status, schoolId, page = 1, limit = 20 } = query;
    const qb = this.jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.postedBy', 'postedBy')
      .orderBy('job.createdAt', 'DESC');

    if (q) {
      qb.andWhere(
        '(job.title ILIKE :q OR job.company ILIKE :q OR job.description ILIKE :q OR job.location ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    if (type) {
      qb.andWhere('job.type = :type', { type });
    }

    if (status) {
      qb.andWhere('job.status = :status', { status });
    } else {
      qb.andWhere('job.status = :status', { status: JobStatus.OPEN });
    }

    if (schoolId) {
      qb.andWhere('job.schoolId = :schoolId', { schoolId });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepo.findOne({
      where: { id },
      relations: ['postedBy', 'applications', 'applications.user'],
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: string, userId: string, dto: any): Promise<Job> {
    const job = await this.findOne(id);
    if (job.postedById !== userId) throw new ForbiddenException('Not your job');
    Object.assign(job, dto);
    return this.jobRepo.save(job);
  }

  async remove(id: string, userId: string): Promise<void> {
    const job = await this.findOne(id);
    if (job.postedById !== userId) throw new ForbiddenException('Not your job');
    await this.jobRepo.remove(job);
  }

  async apply(jobId: string, userId: string, dto: { coverLetter?: string; resumeUrl?: string }): Promise<JobApplication> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.OPEN) throw new BadRequestException('Job is no longer open');
    if (job.postedById === userId) throw new BadRequestException('Cannot apply to your own job');

    const existing = await this.appRepo.findOne({ where: { jobId, userId } });
    if (existing) throw new BadRequestException('Already applied to this job');

    const application = this.appRepo.create({
      jobId,
      userId,
      coverLetter: dto.coverLetter,
      resumeUrl: dto.resumeUrl,
      status: ApplicationStatus.PENDING,
    });

    const saved = await this.appRepo.save(application);

    // Update count
    await this.jobRepo.increment({ id: jobId }, 'applicationsCount', 1);

    // Notify job poster
    const applicant = await this.userRepo.findOne({ where: { id: userId } });
    if (applicant) {
      this.notificationsService
        .notify(
          job.postedById,
          userId,
          NotificationType.POST_COMMENTED, // reuse type — or add JOB_APPLIED later
          undefined,
          jobId,
          applicant.username,
        )
        .catch(() => {});
    }

    return saved;
  }

  async getApplications(jobId: string, userId: string): Promise<JobApplication[]> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.postedById !== userId) throw new ForbiddenException('Not your job');
    return this.appRepo.find({
      where: { jobId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateApplicationStatus(appId: string, userId: string, status: ApplicationStatus): Promise<JobApplication> {
    const app = await this.appRepo.findOne({ where: { id: appId }, relations: ['job'] });
    if (!app) throw new NotFoundException('Application not found');
    if (app.job?.postedById !== userId) throw new ForbiddenException('Not your job');
    app.status = status;
    return this.appRepo.save(app);
  }

  async myApplications(userId: string): Promise<JobApplication[]> {
    return this.appRepo.find({
      where: { userId },
      relations: ['job', 'job.postedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async myPostings(userId: string): Promise<Job[]> {
    return this.jobRepo.find({
      where: { postedById: userId },
      relations: ['postedBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
