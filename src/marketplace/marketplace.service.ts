import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { UpdateMarketplaceDto } from './dto/update-marketplace.dto';
import { MarketplaceItem, MarketplaceStatus } from './entities/marketplace-item.entity';
import { MarketplaceLike } from './entities/marketplace-like.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';

export interface PaginatedMarketplaceResult {
  items: MarketplaceItem[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceItem)
    private readonly marketplaceRepository: Repository<MarketplaceItem>,
    @InjectRepository(MarketplaceLike)
    private readonly marketplaceLikeRepository: Repository<MarketplaceLike>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateMarketplaceDto,
    uploadedFiles: Express.Multer.File[] = [],
  ): Promise<MarketplaceItem> {
    const uploader = await this.userRepository.findOne({ where: { id: userId } });
    if (!uploader) {
      throw new NotFoundException('Uploader user not found');
    }

    // Upload new image files if provided via multipart data
    const newlyUploadedUrls = uploadedFiles.length > 0
      ? await this.uploadImages(uploadedFiles, 'marketplace')
      : [];

    // Combine existing image URLs sent in DTO with newly uploaded file URLs
    const combinedImageUrls = [
      ...(dto.imageUrls || []),
      ...newlyUploadedUrls,
    ];

    const item = this.marketplaceRepository.create({
      ...dto,
      sellerId: userId,
      schoolId: uploader.schoolId,
      imageUrls: combinedImageUrls,
    });

    return this.marketplaceRepository.save(item);
  }

async findAll(options?: {
  schoolId?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedMarketplaceResult> {
  const { schoolId, category, search, page = 1, limit = 20 } = options || {};

  const take = Math.max(1, limit);
  const skip = (Math.max(1, page) - 1) * take;

  const baseWhere: any = {};
  if (schoolId) {
    baseWhere.schoolId = schoolId;
  }
  if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
    baseWhere.category = category.trim();
  }

  let whereCondition: any;

  if (search && search.trim() !== '') {
    const searchTerm = `%${search.trim()}%`;
    whereCondition = [
      { ...baseWhere, title: ILike(searchTerm) },
      { ...baseWhere, description: ILike(searchTerm) },
      { ...baseWhere, brand: ILike(searchTerm) },
      { ...baseWhere, model: ILike(searchTerm) },
    ];
  } else {
    whereCondition = baseWhere;
  }

  const [items, totalItems] = await this.marketplaceRepository.findAndCount({
    where: whereCondition,
    order: { createdAt: 'DESC' },
    relations: ['seller', 'likes'],
    take,
    skip,
  });

  const totalPages = Math.ceil(totalItems / take);

  return {
    items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: take,
      totalPages,
      currentPage: Number(page),
    },
  };
}

  async findOne(id: string): Promise<MarketplaceItem> {
    const item = await this.marketplaceRepository.findOne({
      where: { id },
      relations: ['seller', 'likes'],
    });

    if (!item) {
      throw new NotFoundException(`Marketplace item with ID "${id}" not found`);
    }

    return item;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMarketplaceDto,
    uploadedFiles: Express.Multer.File[] = [],
  ): Promise<MarketplaceItem> {
    const item = await this.findOne(id);

    if (item.sellerId !== userId) {
      throw new Error('You can only update your own marketplace item');
    }

    const uploadedUrls = await this.uploadImages(uploadedFiles, 'marketplace');
    Object.assign(item, dto);
    if (uploadedUrls.length > 0) {
      item.imageUrls = [...(item.imageUrls || []), ...uploadedUrls];
    }
    if (dto.status) {
      item.isAvailable = dto.status === MarketplaceStatus.AVAILABLE;
    }

    return this.marketplaceRepository.save(item);
  }

  async remove(userId: string, id: string): Promise<void> {
    const item = await this.findOne(id);

    if (item.sellerId !== userId) {
      throw new Error('You can only delete your own marketplace item');
    }

    await this.marketplaceRepository.remove(item);
  }

  async toggleLike(userId: string, itemId: string): Promise<{ liked: boolean; likesCount: number }> {
    const item = await this.findOne(itemId);
    const existingLike = await this.marketplaceLikeRepository.findOne({
      where: { marketplaceItemId: itemId, userId },
    });

    if (existingLike) {
      await this.marketplaceLikeRepository.remove(existingLike);
      return { liked: false, likesCount: (item.likes?.length ?? 1) - 1 };
    }

    const like = this.marketplaceLikeRepository.create({ marketplaceItemId: itemId, userId });
    await this.marketplaceLikeRepository.save(like);

    // Notify the seller that their item was liked (skipped if seller likes their own)
    await this.notificationsService.notify(
      item.sellerId,
      userId,
      NotificationType.MARKETPLACE_LIKED,
      NotificationTargetType.MARKETPLACE_ITEM,
      itemId,
    );

    return { liked: true, likesCount: (item.likes?.length ?? 0) + 1 };
  }

  async markAsTaken(userId: string, id: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);

    if (item.sellerId !== userId) {
      throw new Error('You can only update your own marketplace item');
    }

    item.status = MarketplaceStatus.TAKEN;
    item.isAvailable = false;
    return this.marketplaceRepository.save(item);
  }

  async markAsAvailable(userId: string, id: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);

    if (item.sellerId !== userId) {
      throw new Error('You can only update your own marketplace item');
    }

    item.status = MarketplaceStatus.AVAILABLE;
    item.isAvailable = true;
    return this.marketplaceRepository.save(item);
  }

  async markAsUnavailable(userId: string, id: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);

    if (item.sellerId !== userId) {
      throw new Error('You can only update your own marketplace item');
    }

    item.status = MarketplaceStatus.UNAVAILABLE;
    item.isAvailable = false;
    return this.marketplaceRepository.save(item);
  }

  async getContactInfo(id: string): Promise<{ phone?: string; email?: string; sellerName?: string }> {
    const item = await this.findOne(id);
    return {
      phone: item.contactPhone,
      email: item.contactEmail,
      sellerName: item.seller?.fullName || item.seller?.username,
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