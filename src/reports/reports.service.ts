import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentReport, ReportTargetType } from '../posts/entities/content-report.entity';
import { Story } from '../stories/entities/story.entity';
import { MarketplaceItem } from '../marketplace/entities/marketplace-item.entity';
import { HostelListing } from '../hostels/entities/hostel-listing.entity';
import { PastQuestion } from '../past-questions/entities/past-question.entity';
import { CampusMaterial } from '../materials/entities/campus-material.entity';
import { CreateReportDto, GenericReportType } from './dto/create-report.dto';

interface ReportTarget {
  ownerId: string;
  /** Text copy of the content, kept in case the owner edits or deletes it. */
  snapshot: string;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join('\n');
const fileUris = (files?: { uri: string }[] | null) => (files ?? []).map((f) => f.uri);

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reportRepository: Repository<ContentReport>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(MarketplaceItem)
    private readonly marketplaceRepository: Repository<MarketplaceItem>,
    @InjectRepository(HostelListing)
    private readonly hostelRepository: Repository<HostelListing>,
    @InjectRepository(PastQuestion)
    private readonly pastQuestionRepository: Repository<PastQuestion>,
    @InjectRepository(CampusMaterial)
    private readonly materialRepository: Repository<CampusMaterial>,
  ) {}

  async create(userId: string, dto: CreateReportDto): Promise<ContentReport> {
    const target = await this.findTarget(dto.targetType, dto.targetId);
    if (!target) {
      throw new NotFoundException('The content you are reporting no longer exists');
    }
    if (target.ownerId === userId) {
      throw new BadRequestException('You cannot report your own content');
    }

    const report = this.reportRepository.create({
      reporterId: userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      targetOwnerId: target.ownerId,
      reason: dto.reason,
      targetSnapshot: target.snapshot || null,
    });
    return this.reportRepository.save(report);
  }

  private async findTarget(type: GenericReportType, id: string): Promise<ReportTarget | null> {
    switch (type) {
      case ReportTargetType.STORY: {
        const story = await this.storyRepository.findOne({ where: { id } });
        return story && { ownerId: story.userId, snapshot: join(story.textContent, story.mediaUrl) };
      }
      case ReportTargetType.MARKETPLACE_ITEM: {
        const item = await this.marketplaceRepository.findOne({ where: { id } });
        return (
          item && {
            ownerId: item.sellerId,
            snapshot: join(item.title, item.description, ...(item.imageUrls ?? [])),
          }
        );
      }
      case ReportTargetType.HOSTEL_LISTING: {
        const hostel = await this.hostelRepository.findOne({ where: { id } });
        return (
          hostel && {
            ownerId: hostel.sellerId,
            snapshot: join(hostel.hostelName, hostel.description, ...(hostel.imageUrls ?? [])),
          }
        );
      }
      case ReportTargetType.PAST_QUESTION: {
        const pq = await this.pastQuestionRepository.findOne({ where: { id } });
        return (
          pq && {
            ownerId: pq.uploaderId,
            snapshot: join(`${pq.courseCode} ${pq.course} (${pq.session})`, ...fileUris(pq.files)),
          }
        );
      }
      case ReportTargetType.MATERIAL: {
        const material = await this.materialRepository.findOne({ where: { id } });
        return (
          material && {
            ownerId: material.uploaderId,
            snapshot: join(material.title, material.description, ...fileUris(material.files)),
          }
        );
      }
    }
  }
}
