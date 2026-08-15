import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { HostelListing, HostelStatus } from './entities/hostel-listing.entity';
import { HostelLike } from './entities/hostel-like.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';

@Injectable()
export class HostelsService {
  constructor(
    @InjectRepository(HostelListing)
    private readonly hostelRepository: Repository<HostelListing>,
    @InjectRepository(HostelLike)
    private readonly hostelLikeRepository: Repository<HostelLike>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateHostelDto,
    uploadedFiles: Express.Multer.File[] = [],
  ): Promise<HostelListing> {
    const uploader = await this.userRepository.findOne({ where: { id: userId } });
    if (!uploader) {
      throw new NotFoundException('Uploader user not found');
    }

    const imageUrls = await this.uploadImages(uploadedFiles, 'hostels');
    const { school, ...hostelDto } = dto;
    const hostel = this.hostelRepository.create({
      ...hostelDto,
      seller: { id: userId },
      school: { id: uploader.schoolId },
      imageUrls: [...(dto.imageUrls || []), ...imageUrls],
    });
    return this.hostelRepository.save(hostel);
  }

  async findAll(schoolId?: string): Promise<HostelListing[]> {
    return this.hostelRepository.find({
      where: schoolId ? { schoolId } : {},
      order: { createdAt: 'DESC' },
      relations: ['seller', 'likes'],
    });
  }

  async findOne(id: string): Promise<HostelListing> {
    const hostel = await this.hostelRepository.findOne({
      where: { id },
      relations: ['seller', 'likes'],
    });

    if (!hostel) {
      throw new NotFoundException(`Hostel listing with ID "${id}" not found`);
    }

    return hostel;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateHostelDto,
    uploadedFiles: Express.Multer.File[] = [],
  ): Promise<HostelListing> {
    const hostel = await this.findOne(id);

    if (hostel.sellerId !== userId) {
      throw new Error('You can only update your own hostel listing');
    }

    const uploadedUrls = await this.uploadImages(uploadedFiles, 'hostels');
    Object.assign(hostel, dto);
    if (uploadedUrls.length > 0) {
      hostel.imageUrls = [...(hostel.imageUrls || []), ...uploadedUrls];
    }
    if (dto.status) {
      hostel.isAvailable = dto.status === HostelStatus.AVAILABLE;
    }

    return this.hostelRepository.save(hostel);
  }

  async remove(userId: string, id: string): Promise<void> {
    const hostel = await this.findOne(id);

    if (hostel.sellerId !== userId) {
      throw new Error('You can only delete your own hostel listing');
    }

    await this.hostelRepository.remove(hostel);
  }

  async toggleLike(userId: string, hostelId: string): Promise<{ liked: boolean; likesCount: number }> {
    const hostel = await this.findOne(hostelId);
    const existingLike = await this.hostelLikeRepository.findOne({
      where: { hostelId, userId },
    });

    if (existingLike) {
      await this.hostelLikeRepository.remove(existingLike);
      return { liked: false, likesCount: (hostel.likes?.length ?? 1) - 1 };
    }

    const like = this.hostelLikeRepository.create({ hostelId, userId });
    await this.hostelLikeRepository.save(like);

    // Notify the seller that their listing was liked (skipped if seller likes their own)
    await this.notificationsService.notify(
      hostel.sellerId,
      userId,
      NotificationType.HOSTEL_LIKED,
      NotificationTargetType.HOSTEL,
      hostelId,
    );

    return { liked: true, likesCount: (hostel.likes?.length ?? 0) + 1 };
  }

  async markAsTaken(userId: string, id: string): Promise<HostelListing> {
    const hostel = await this.findOne(id);

    if (hostel.sellerId !== userId) {
      throw new Error('You can only update your own hostel listing');
    }

    hostel.status = HostelStatus.TAKEN;
    hostel.isAvailable = false;
    return this.hostelRepository.save(hostel);
  }

  async markAsAvailable(userId: string, id: string): Promise<HostelListing> {
    const hostel = await this.findOne(id);

    if (hostel.sellerId !== userId) {
      throw new Error('You can only update your own hostel listing');
    }

    hostel.status = HostelStatus.AVAILABLE;
    hostel.isAvailable = true;
    return this.hostelRepository.save(hostel);
  }

  async markAsUnavailable(userId: string, id: string): Promise<HostelListing> {
    const hostel = await this.findOne(id);

    if (hostel.sellerId !== userId) {
      throw new Error('You can only update your own hostel listing');
    }

    hostel.status = HostelStatus.UNAVAILABLE;
    hostel.isAvailable = false;
    return this.hostelRepository.save(hostel);
  }

  async getContactInfo(id: string): Promise<{ phone?: string; email?: string; sellerName?: string }> {
    const hostel = await this.findOne(id);
    return {
      phone: hostel.contactPhone,
      email: hostel.contactEmail,
      sellerName: hostel.seller?.fullName || hostel.seller?.username,
    };
  }

  async getUserSchool(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  private async uploadImages(files: Express.Multer.File[], folder: string): Promise<string[]> {
    if (!files?.length) {
      return [];
    }

    const uploadResults = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadFile(file, { folder })),
    );

    return uploadResults.map((result) => result.secure_url);
  }
}
