import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { PastQuestion } from './entities/past-question.entity';
import { CreatePastQuestionDto } from './dto/create-past-question.dto';
import { ListPastQuestionsDto } from './dto/list-past-questions.dto';
import { User } from '../users/entities/user.entity';
import { CoinsService } from '../coins/coins.service';
import { CoinBalance } from '../coins/entities/coin-balance.entity';
import { CoinTransaction, CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';

export interface PastQuestionFile {
  name: string;
  uri: string;
  size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PastQuestionsService {
  constructor(
    @InjectRepository(PastQuestion)
    private readonly pqRepo: Repository<PastQuestion>,
    @InjectRepository(CoinTransaction)
    private readonly coinTransactionRepo: Repository<CoinTransaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly coinsService: CoinsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Uploads the multipart files to Cloudinary and returns their metadata */
  private async uploadFiles(files: Express.Multer.File[]): Promise<PastQuestionFile[]> {
    const uploadResults = await Promise.all(
      files.map((file) =>
        this.cloudinaryService.uploadFile(file, {
          folder: 'past-questions',
          resourceType: 'auto',
        }),
      ),
    );

    return uploadResults.map((result, index) => ({
      name: files[index].originalname,
      uri: result.secure_url,
      size: files[index].size,
    }));
  }

  async create(
    userId: string,
    dto: CreatePastQuestionDto,
    files?: Express.Multer.File[],
  ): Promise<PastQuestion> {
    let fileMeta: PastQuestionFile[] | undefined = dto.files;
    if (files && files.length > 0) {
      fileMeta = await this.uploadFiles(files);
    }
    if (!fileMeta || fileMeta.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const pq = this.pqRepo.create({
      level: dto.level,
      // courseCode: dto.courseCode, 
      course: dto.course,
      session: dto.session,
      semester: dto.semester,
      files: fileMeta,
      uploaderId: userId,
      priceCoins: dto.priceCoins ?? 0,
    });
    const saved = await this.pqRepo.save(pq);

    // Notify all departmentmates about the new past question
    try {
      await this.notificationsService.notifyDepartmentmates(
        userId,
        NotificationType.PAST_QUESTION_UPLOADED,
        NotificationTargetType.PAST_QUESTION,
        saved.id,
      );
    } catch {
      // best-effort
    }

    return saved;
  }

  async findById(id: string): Promise<PastQuestion | null> {
    return this.pqRepo.findOne({ where: { id } });
  }

  /** Builds a query for listing past questions with optional filters and department scope */
  private buildListQuery(
    dto: ListPastQuestionsDto,
    departmentId?: string,
  ): SelectQueryBuilder<PastQuestion> {
    const qb = this.pqRepo
      .createQueryBuilder('pq')
      .leftJoin('pq.uploader', 'uploader')
      .addSelect([
        'uploader.id',
        'uploader.firstName',
        'uploader.lastName',
        'uploader.username',
        'uploader.profilePictureUrl',
      ]);

    if (departmentId) {
      qb.andWhere('uploader.departmentId = :departmentId', { departmentId });
    }
    if (dto.level) {
      qb.andWhere('pq.level = :level', { level: dto.level });
    }
    // if (dto.courseCode) {
    //   // 👈 Filters directly by course code if provided in query params
    //   qb.andWhere('pq.courseCode ILIKE :courseCode', { courseCode: `%${dto.courseCode}%` });
    // }
    if (dto.course) {
      // 👈 Search across both course name and courseCode when searching title/course
      qb.andWhere('(pq.course ILIKE :course OR pq.courseCode ILIKE :course)', {
        course: `%${dto.course}%`,
      });
    }
    if (dto.session) {
      qb.andWhere('pq.session = :session', { session: dto.session });
    }
    if (dto.semester) {
      qb.andWhere('pq.semester = :semester', { semester: dto.semester });
    }

    qb.orderBy('pq.createdAt', 'DESC').addOrderBy('pq.id', 'DESC');
    return qb;
  }

  /** Handles page-based offset pagination */
  private async paginate(
    qb: SelectQueryBuilder<PastQuestion>,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<PastQuestion>> {
    const skip = (page - 1) * limit;

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** List past questions with optional filters (all departments) */
  async list(dto: ListPastQuestionsDto): Promise<PaginatedResponse<PastQuestion>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    return this.paginate(this.buildListQuery(dto), page, limit);
  }

  /** List past questions uploaded by users in the current user's department */
  async listByDepartment(
    userId: string,
    dto: ListPastQuestionsDto,
  ): Promise<PaginatedResponse<PastQuestion>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.departmentId) {
      throw new BadRequestException('User has no department assigned');
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    return this.paginate(this.buildListQuery(dto, user.departmentId), page, limit);
  }

  /** Purchase / Download logic remains unchanged */
  /**
   * Top contributors: users who uploaded the most past questions in the same department.
   */
  async topContributors(userId: string, limit = 10): Promise<any[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.departmentId) return [];

    const rows = await this.dataSource.query(
      `SELECT
         u.id AS "userId",
         u."firstName",
         u."lastName",
         u."username",
         u."profilePictureUrl",
         u."profileFrame",
         u."departmentId",
         COUNT(pq.id)::int AS uploads,
         lvl."level" AS "levelNumber",
         lvl."badge",
         lvl."emoji",
         lvl."color",
         lvl."title" AS "levelTitle",
         EXISTS(SELECT 1 FROM "follows" f WHERE f."followerId" = $1 AND f."followingId" = u.id) AS "isFollowing"
       FROM past_questions pq
       JOIN users u ON u.id = pq."uploaderId"
       LEFT JOIN "user_xp" ux ON ux."userId" = u.id
       LEFT JOIN "levels" lvl ON ux."totalXp" >= lvl."minXp" AND (lvl."maxXp" IS NULL OR ux."totalXp" <= lvl."maxXp")
       WHERE u."departmentId" = $2 AND u.id != $1
       GROUP BY u.id, u."firstName", u."lastName", u."username", u."profilePictureUrl", u."profileFrame", u."departmentId", lvl."level", lvl."badge", lvl."emoji", lvl."color", lvl."title"
       ORDER BY uploads DESC
       LIMIT $3`,
      [userId, user.departmentId, limit],
    );

    return rows;
  }

  async purchaseAndGetFiles(pastQuestionId: string, buyerId: string): Promise<{ files: any[] }> {
    const pq = await this.pqRepo.findOne({ where: { id: pastQuestionId } });
    if (!pq) throw new NotFoundException('Past question not found');

    if ((pq.priceCoins ?? 0) <= 0 || pq.uploaderId === buyerId) {
      pq.downloadsCount = (pq.downloadsCount ?? 0) + 1;
      await this.pqRepo.save(pq);
      return { files: pq.files ?? [] };
    }

    const price = Number(pq.priceCoins);

    const alreadyPurchased = await this.coinTransactionRepo.findOne({
      where: { userId: buyerId, referenceId: pastQuestionId, type: CoinTransactionType.GIFT_SENT },
    });
    if (alreadyPurchased) {
      pq.downloadsCount = (pq.downloadsCount ?? 0) + 1;
      await this.pqRepo.save(pq);
      return { files: pq.files ?? [] };
    }

    await this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(CoinBalance);
      const txRepo = manager.getRepository(CoinTransaction);
      const pqRepo = manager.getRepository(PastQuestion);

      const buyerBalance = await balanceRepo.findOne({ where: { userId: buyerId } });
      if (!buyerBalance || Number(buyerBalance.balance) < price) {
        throw new BadRequestException('Insufficient Campus Coins balance');
      }

      const sellerBalance = await balanceRepo.findOne({ where: { userId: pq.uploaderId } });
      let sellerBal = sellerBalance;
      if (!sellerBal) {
        sellerBal = balanceRepo.create({ userId: pq.uploaderId, balance: 0, earnedBalance: 0 });
        await balanceRepo.save(sellerBal);
      }

      buyerBalance.balance = Number(buyerBalance.balance) - price;
      await balanceRepo.save(buyerBalance);
      await txRepo.save(
        txRepo.create({
          userId: buyerId,
          amount: -price,
          type: CoinTransactionType.GIFT_SENT,
          referenceId: pastQuestionId,
          balanceAfter: buyerBalance.balance,
        }),
      );

      sellerBal.balance = Number(sellerBal.balance) + price;
      await balanceRepo.save(sellerBal);
      await txRepo.save(
        txRepo.create({
          userId: pq.uploaderId,
          amount: price,
          type: CoinTransactionType.GIFT_RECEIVED,
          referenceId: pastQuestionId,
          balanceAfter: sellerBal.balance,
        }),
      );

      pq.downloadsCount = (pq.downloadsCount ?? 0) + 1;
      await pqRepo.save(pq);
    });

    await this.notificationsService.notify(
      pq.uploaderId,
      buyerId,
      NotificationType.PAST_QUESTION_PURCHASED,
      NotificationTargetType.PAST_QUESTION,
      pastQuestionId,
    );

    return { files: pq.files ?? [] };
  }

  async getDownloadUrl(pastQuestionId: string, buyerId: string): Promise<{ url: string }> {
    const { files } = await this.purchaseAndGetFiles(pastQuestionId, buyerId);
    if (!files || files.length === 0) {
      throw new NotFoundException('Past question has no files to download');
    }
    return { url: files[0].uri };
  }
}