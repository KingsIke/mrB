import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { UpdateMarketplaceDto } from './dto/update-marketplace.dto';
import { MarketplaceItem, MarketplaceStatus, ModerationStatus } from './entities/marketplace-item.entity';
import { MarketplaceLike } from './entities/marketplace-like.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpService } from '../otp/otp.service';
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
    private readonly otpService: OtpService,
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
      moderationStatus: ModerationStatus.PENDING,
    });

    // Listings start PENDING and are invisible to everyone but the seller
    // until an admin approves them — schoolmates are only notified once
    // that happens (see `approve()`).
    const saved = await this.marketplaceRepository.save(item);

    return saved;
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

  const baseWhere: any = {
    moderationStatus: ModerationStatus.APPROVED,
    // Closed (taken/unavailable) listings shouldn't show up in the public
    // browse feed — the seller closed it for a reason.
    status: MarketplaceStatus.AVAILABLE,
  };
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

  /**
   * @param viewerId When passed (public-facing lookups), a listing that
   * isn't APPROVED yet is hidden from everyone except its own seller —
   * pending/rejected items aren't "listed" and shouldn't be reachable by
   * guessing/sharing a direct link. Omitted for internal calls (update,
   * remove, admin tools, etc.) which already do their own authorization.
   */
  async findOne(id: string, viewerId?: string): Promise<MarketplaceItem> {
    const item = await this.marketplaceRepository.findOne({
      where: { id },
      relations: ['seller', 'likes'],
    });

    if (!item) {
      throw new NotFoundException(`Marketplace item with ID "${id}" not found`);
    }

    if (
      viewerId !== undefined &&
      item.moderationStatus !== ModerationStatus.APPROVED &&
      item.sellerId !== viewerId
    ) {
      throw new NotFoundException(`Marketplace item with ID "${id}" not found`);
    }

    return item;
  }

  /** All of the current user's own listings, regardless of moderation status. */
  async myListings(userId: string): Promise<MarketplaceItem[]> {
    return this.marketplaceRepository.find({
      where: { sellerId: userId },
      order: { createdAt: 'DESC' },
      relations: ['seller', 'likes'],
    });
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

  // ── Admin methods ──────────────────────────────────────────────

  async adminListAll(): Promise<MarketplaceItem[]> {
    return this.marketplaceRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['seller'],
    });
  }

  /** Moderation queue — oldest submission first, like any review queue. */
  async adminListPending(): Promise<MarketplaceItem[]> {
    return this.marketplaceRepository.find({
      where: { moderationStatus: ModerationStatus.PENDING },
      order: { createdAt: 'ASC' },
      relations: ['seller'],
    });
  }

  /** Approves a listing, making it visible in the public feed, and notifies the seller + their schoolmates. */
  async approve(id: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);
    item.moderationStatus = ModerationStatus.APPROVED;
    item.rejectionReason = undefined;
    const saved = await this.marketplaceRepository.save(item);

    try {
      await this.notificationsService.notify(
        item.sellerId,
        null,
        NotificationType.MARKETPLACE_ITEM_APPROVED,
        NotificationTargetType.MARKETPLACE_ITEM,
        saved.id,
        'The Admin Team',
      );
      await this.notificationsService.notifySchoolmates(
        item.sellerId,
        NotificationType.MARKETPLACE_ITEM_LISTED,
        NotificationTargetType.MARKETPLACE_ITEM,
        saved.id,
      );
    } catch {
      // best-effort — approval is already persisted
    }

    // Email the seller their listing is live (in-app + push were sent above).
    // Best-effort — the approval is already persisted.
    try {
      await this.otpService.notifyUserOfMarketplaceItemDecision(
        item.seller,
        item.title,
        true,
      );
    } catch {
      // best-effort — approval is already persisted
    }

    return saved;
  }

  /** Rejects a listing — it stays invisible to everyone but the seller, who's told why. */
  async reject(id: string, reason?: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);
    item.moderationStatus = ModerationStatus.REJECTED;
    item.rejectionReason = reason;
    const saved = await this.marketplaceRepository.save(item);

    try {
      await this.notificationsService.notify(
        item.sellerId,
        null,
        NotificationType.MARKETPLACE_ITEM_REJECTED,
        NotificationTargetType.MARKETPLACE_ITEM,
        saved.id,
        'The Admin Team',
        reason,
      );
    } catch {
      // best-effort — rejection is already persisted
    }

    // Email the seller the decision and the reason (in-app + push got it too).
    // Best-effort — the rejection is already persisted.
    try {
      await this.otpService.notifyUserOfMarketplaceItemDecision(
        item.seller,
        item.title,
        false,
        reason,
      );
    } catch {
      // best-effort — rejection is already persisted
    }

    return saved;
  }

  async approveMany(ids: string[]): Promise<{ approved: string[]; errors: string[] }> {
    const approved: string[] = [];
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.approve(id);
        approved.push(id);
      } catch {
        errors.push(id);
      }
    }
    return { approved, errors };
  }

  async rejectMany(ids: string[], reason?: string): Promise<{ rejected: string[]; errors: string[] }> {
    const rejected: string[] = [];
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.reject(id, reason);
        rejected.push(id);
      } catch {
        errors.push(id);
      }
    }
    return { rejected, errors };
  }

  async adminCreate(userId: string, dto: CreateMarketplaceDto): Promise<MarketplaceItem> {
    const item = this.marketplaceRepository.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      brand: dto.brand,
      model: dto.model,
      condition: dto.condition,
      location: dto.location,
      price: dto.price,
      sellerId: userId,
      schoolId: (dto as any).schoolId || undefined,
    });
    return this.marketplaceRepository.save(item);
  }

  async adminUpdate(id: string, dto: UpdateMarketplaceDto): Promise<MarketplaceItem> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.marketplaceRepository.save(item);
  }

  async adminToggleStatus(id: string): Promise<MarketplaceItem> {
    const item = await this.findOne(id);
    item.isAvailable = !item.isAvailable;
    item.status = item.isAvailable ? MarketplaceStatus.AVAILABLE : MarketplaceStatus.UNAVAILABLE;
    return this.marketplaceRepository.save(item);
  }

  async adminDelete(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.marketplaceRepository.remove(item);
  }

  async adminDeleteMany(ids: string[]): Promise<{ deleted: string[]; errors: string[] }> {
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
}