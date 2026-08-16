import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventCategory, Event } from './entities/event.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User } from '../users/entities/user.entity';
import { PaginationDto, PaginatedResult } from './dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private paginate<T>(
    data: T[],
    totalItems: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async create(
    userId: string,
    dto: CreateEventDto,
    uploadedFile?: Express.Multer.File,
  ): Promise<Event> {
    const creator = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    let coverImage: string | undefined = dto.coverImage;

    if (uploadedFile) {
      const uploadResult = await this.cloudinaryService.uploadFile(
        uploadedFile,
        { folder: 'events' },
      );
      coverImage = uploadResult.secure_url;
    }

    const event = this.eventRepository.create({
      ...dto,
      creatorId: userId,
      schoolId: creator.schoolId,
      coverImage,
    });

    return await this.eventRepository.save(event);
  }

  // Helper to fetch user's schoolId securely
  private async getUserSchoolId(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'schoolId'],
    });

    if (!user || !user.schoolId) {
      throw new NotFoundException('User or associated school not found');
    }

    return user.schoolId;
  }

  async findAll(
    userId: string,
    paginationDto: PaginationDto,
    category?: EventCategory,
  ): Promise<PaginatedResult<Event>> {
    const schoolId = await this.getUserSchoolId(userId);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const whereCondition: any = { schoolId };

    if (category && category !== EventCategory.ALL) {
      whereCondition.category = category;
    }

    const [data, totalItems] = await this.eventRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return this.paginate(data, totalItems, page, limit);
  }

  async findUpcoming(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Event>> {
    const schoolId = await this.getUserSchoolId(userId);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const today = new Date().toISOString().split('T')[0];

    const [data, totalItems] = await this.eventRepository.findAndCount({
      where: {
        schoolId,
        date: MoreThanOrEqual(today),
      },
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return this.paginate(data, totalItems, page, limit);
  }

  async findPast(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Event>> {
    const schoolId = await this.getUserSchoolId(userId);

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const today = new Date().toISOString().split('T')[0];

    const [data, totalItems] = await this.eventRepository.findAndCount({
      where: {
        schoolId,
        date: LessThan(today),
      },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return this.paginate(data, totalItems, page, limit);
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }
    return event;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateEventDto,
    uploadedFile?: Express.Multer.File,
  ): Promise<Event> {
    const event = await this.findOne(id);

    if (event.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own event');
    }

    if (uploadedFile) {
      const uploadResult = await this.cloudinaryService.uploadFile(
        uploadedFile,
        { folder: 'events' },
      );
      event.coverImage = uploadResult.secure_url;
    }

    Object.assign(event, dto);

    return await this.eventRepository.save(event);
  }

  async remove(userId: string, id: string): Promise<void> {
    const event = await this.findOne(id);

    if (event.creatorId !== userId) {
      throw new ForbiddenException('You can only delete your own event');
    }

    await this.eventRepository.remove(event);
  }

  async toggleRsvp(userId: string, id: string): Promise<Event> {
    const event = await this.findOne(id);
    event.interestedCount = (event.interestedCount || 0) + 1;
    const saved = await this.eventRepository.save(event);

    // Notify the event creator that someone RSVP'd (skipped if the creator RSVPs themselves)
    await this.notificationsService.notify(
      event.creatorId,
      userId,
      NotificationType.EVENT_RSVP,
      NotificationTargetType.EVENT,
      id,
    );

    return saved;
  }
}