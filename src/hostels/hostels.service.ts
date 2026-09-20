import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { HostelListing, HostelStatus, ModerationStatus } from './entities/hostel-listing.entity';
import { HostelLike } from './entities/hostel-like.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpService } from '../otp/otp.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';

// The seller relation is embedded in every listing response — restrict it to
// display-safe fields in JS after the query so the password hash and other
// account/moderation details never leave the API.
const SAFE_SELLER_FIELDS = [
  'id',
  'username',
  'firstName',
  'lastName',
  'profilePictureUrl',
  'profileFrame',
  'phoneNumber',
] as const;

function sanitizeSeller<T extends { seller?: User | null }>(item: T): T {
  if (item.seller) {
    const safeSeller: Partial<User> = {};
    for (const field of SAFE_SELLER_FIELDS) {
      (safeSeller as any)[field] = item.seller[field];
    }
    item.seller = safeSeller as User;
  }
  return item;
}

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
    private readonly otpService: OtpService,
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
      moderationStatus: ModerationStatus.PENDING,
    });
    // Listings start PENDING and are invisible to everyone but the seller
    // until an admin approves them — schoolmates are only notified once
    // that happens (see `approve()`).
    const saved = await this.hostelRepository.save(hostel);

    return saved;
  }

  async findAll(schoolId?: string): Promise<HostelListing[]> {
    // Closed (taken/unavailable) listings shouldn't show up in the public
    // browse feed — the seller closed it for a reason.
    const baseWhere: any = {
      moderationStatus: ModerationStatus.APPROVED,
      status: HostelStatus.AVAILABLE,
    };
    if (schoolId) {
      baseWhere.schoolId = schoolId;
    }

    const listings = await this.hostelRepository.find({
      where: baseWhere,
      order: { createdAt: 'DESC' },
      relations: ['seller', 'likes'],
    });
    return listings.map(sanitizeSeller);
  }

  /**
   * @param viewerId When passed (public-facing lookups), a listing that
   * isn't APPROVED yet is hidden from everyone except its own seller.
   * Omitted for internal calls (update, remove, admin tools, etc.) which
   * already do their own authorization.
   */
  async findOne(id: string, viewerId?: string): Promise<HostelListing> {
    const hostel = await this.hostelRepository.findOne({
      where: { id },
      relations: ['seller', 'likes'],
    });

    if (!hostel) {
      throw new NotFoundException(`Hostel listing with ID "${id}" not found`);
    }

    if (
      viewerId !== undefined &&
      hostel.moderationStatus !== ModerationStatus.APPROVED &&
      hostel.sellerId !== viewerId
    ) {
      throw new NotFoundException(`Hostel listing with ID "${id}" not found`);
    }

    return sanitizeSeller(hostel);
  }

  /** All of the current user's own listings, regardless of moderation status. */
  async myListings(userId: string): Promise<HostelListing[]> {
    const listings = await this.hostelRepository.find({
      where: { sellerId: userId },
      order: { createdAt: 'DESC' },
      relations: ['seller', 'likes'],
    });
    return listings.map(sanitizeSeller);
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

  // ── Admin methods ──────────────────────────────────────────────

  async adminListAll(): Promise<HostelListing[]> {
    return this.hostelRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['seller'],
    });
  }

  /** Moderation queue — oldest submission first, like any review queue. */
  async adminListPending(): Promise<HostelListing[]> {
    return this.hostelRepository.find({
      where: { moderationStatus: ModerationStatus.PENDING },
      order: { createdAt: 'ASC' },
      relations: ['seller'],
    });
  }

  /** Approves a listing, making it visible in the public feed, and notifies the seller + their schoolmates. */
  async approve(id: string): Promise<HostelListing> {
    const hostel = await this.findOne(id);
    hostel.moderationStatus = ModerationStatus.APPROVED;
    hostel.rejectionReason = undefined;
    const saved = await this.hostelRepository.save(hostel);

    try {
      await this.notificationsService.notify(
        hostel.sellerId,
        null,
        NotificationType.HOSTEL_APPROVED,
        NotificationTargetType.HOSTEL,
        saved.id,
        'The Admin Team',
      );
      await this.notificationsService.notifySchoolmates(
        hostel.sellerId,
        NotificationType.HOSTEL_LISTED,
        NotificationTargetType.HOSTEL,
        saved.id,
      );
    } catch {
      // best-effort — approval is already persisted
    }

    // Email the lister their listing is live (in-app + push were sent above).
    // Best-effort — the approval is already persisted.
    try {
      await this.otpService.notifyUserOfHostelListingDecision(
        hostel.seller,
        hostel.hostelName,
        true,
      );
    } catch {
      // best-effort — approval is already persisted
    }

    return saved;
  }

  /** Rejects a listing — it stays invisible to everyone but the seller, who's told why. */
  async reject(id: string, reason?: string): Promise<HostelListing> {
    const hostel = await this.findOne(id);
    hostel.moderationStatus = ModerationStatus.REJECTED;
    hostel.rejectionReason = reason;
    const saved = await this.hostelRepository.save(hostel);

    try {
      await this.notificationsService.notify(
        hostel.sellerId,
        null,
        NotificationType.HOSTEL_REJECTED,
        NotificationTargetType.HOSTEL,
        saved.id,
        'The Admin Team',
        reason,
      );
    } catch {
      // best-effort — rejection is already persisted
    }

    // Email the lister the decision and the reason (in-app + push got it too).
    // Best-effort — the rejection is already persisted.
    try {
      await this.otpService.notifyUserOfHostelListingDecision(
        hostel.seller,
        hostel.hostelName,
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

  async adminCreate(userId: string, dto: CreateHostelDto): Promise<HostelListing> {
    const listing = this.hostelRepository.create({
      hostelName: dto.hostelName,
      description: dto.description,
      location: dto.location,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      price: dto.price,
      monthlyRent: dto.monthlyRent,
      serviceCharge: dto.serviceCharge,
      cautionFee: dto.cautionFee,
      roomType: dto.roomType,
      gender: dto.gender,
      capacity: dto.capacity,
      availableRooms: dto.availableRooms,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      amenities: dto.amenities,
      curfew: dto.curfew,
      visitorsAllowed: dto.visitorsAllowed,
      petsAllowed: dto.petsAllowed,
      smokingAllowed: dto.smokingAllowed,
      lookingForRoommate: dto.lookingForRoommate,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      whatsapp: dto.whatsapp,
      contactEmail: dto.contactEmail,
      sellerId: userId,
      schoolId: (dto as any).schoolId || undefined,
    });
    return this.hostelRepository.save(listing);
  }

  async adminUpdate(id: string, dto: UpdateHostelDto): Promise<HostelListing> {
    const listing = await this.findOne(id);
    Object.assign(listing, dto);
    return this.hostelRepository.save(listing);
  }

  async adminToggleStatus(id: string): Promise<HostelListing> {
    const listing = await this.findOne(id);
    listing.isAvailable = !listing.isAvailable;
    listing.status = listing.isAvailable ? HostelStatus.AVAILABLE : HostelStatus.UNAVAILABLE;
    return this.hostelRepository.save(listing);
  }

  async adminDelete(id: string): Promise<void> {
    const listing = await this.findOne(id);
    await this.hostelRepository.remove(listing);
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
