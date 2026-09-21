import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  Post,
  PostStatus,
  PostType,
  CommentPermission,
  TextPostSlide,
} from "./entities/post.entity";
import { PostMedia, PostMediaType } from "./entities/post-media.entity";
import { PostTag } from "./entities/post-tag.entity";
import { PostLike } from "./entities/post-like.entity";
import { PostComment } from "./entities/post-comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { PostReshare } from "./entities/post-reshare.entity";
import { PostFavorite } from "./entities/post-favorite.entity";
import {
  ContentReport,
  ReportTargetType,
} from "./entities/content-report.entity";
import { PostView } from "./entities/post-view.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { FeedQueryDto, FeedTab } from "./dto/feed-query.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  NotificationTargetType,
  NotificationType,
} from "../notifications/entities/notification.entity";
import { GamificationService } from "../gamification/gamification.service";
import { Level } from "../gamification/entities/level.entity";
import { XpSource } from "../gamification/entities/xp-transaction.entity";
import { GiftTransaction, GiftTargetType } from "../gifts/entities/gift-transaction.entity";
import { FollowsService } from "../follows/follows.service";
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from "../common/pagination/cursor-pagination.dto";
import { PostsGateway, PostWebSocketEvents } from "./posts.gateway";

const HASHTAG_REGEX = /#[\w]+/g;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
    @InjectRepository(PostComment)
    private readonly commentRepository: Repository<PostComment>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(PostReshare)
    private readonly reshareRepository: Repository<PostReshare>,
    @InjectRepository(PostFavorite)
    private readonly favoriteRepository: Repository<PostFavorite>,
    @InjectRepository(ContentReport)
    private readonly reportRepository: Repository<ContentReport>,
    @InjectRepository(GiftTransaction)
    private readonly giftTransactionRepository: Repository<GiftTransaction>,
    @InjectRepository(PostView)
    private readonly postViewRepository: Repository<PostView>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly gamificationService: GamificationService,
    private readonly followsService: FollowsService,
    private readonly postsGateway: PostsGateway,
  ) {}

  private extractHashtags(description?: string): string[] {
    if (!description) return [];
    const matches = description.match(HASHTAG_REGEX) ?? [];
    return [...new Set(matches)];
  }

  /**
   * Parses the client's JSON-stringified text-slide carousel. Malformed or
   * missing input just means no carousel — the singular backgroundColor/
   * textAlign/fontStyle/fontSize fields (mirroring slide[0]) still carry the
   * post, so this never blocks post creation.
   */
  private parseTextSlides(raw?: string): TextPostSlide[] | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const slides = parsed.filter(
        (slide): slide is TextPostSlide =>
          slide && typeof slide === 'object' && typeof slide.text === 'string',
      );
      return slides.length > 0 ? slides : null;
    } catch {
      return null;
    }
  }

  private async getCommentOrThrow(id: string): Promise<PostComment> {
    const comment = await this.commentRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID "${id}" not found`);
    }
    return comment;
  }

  /** Used to resolve a comment/reply notification deep link: if the target
   * isn't among a post's top-level comments, this tells the client which
   * parent comment to expand (parentCommentId) to reveal it. */
  async getCommentById(id: string): Promise<PostComment> {
    return this.getCommentOrThrow(id);
  }

  async create(
    userId: string,
    dto: CreatePostDto,
    files: Express.Multer.File[],
  ): Promise<Post> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const media: PostMedia[] = [];
    for (const [index, file] of files.entries()) {
      const isVideo = file.mimetype.startsWith("video/");
      const result = await this.cloudinaryService.uploadFile(file, {
        folder: "posts",
        resourceType: isVideo ? "video" : "image",
        transformation: [
          isVideo
            ? { crop: "limit", width: 720 }
            : { crop: "fill", width: 1080 },
        ],
      });
      const item = new PostMedia();
      item.url = result.secure_url;
      item.thumbnailUrl = isVideo ? null : result.secure_url;
      item.mediaType = isVideo ? PostMediaType.VIDEO : PostMediaType.IMAGE;
      item.order = index;
      media.push(item);
    }

    let type = PostType.TEXT;
    if (media.length > 0) {
      const hasImage = media.some((m) => m.mediaType === PostMediaType.IMAGE);
      const hasVideo = media.some((m) => m.mediaType === PostMediaType.VIDEO);
      type =
        hasImage && hasVideo
          ? PostType.MIXED
          : hasVideo
            ? PostType.VIDEO
            : PostType.IMAGE;
    }

    const tags = (dto.taggedUserIds ?? []).map((taggedUserId) => {
      const tag = new PostTag();
      tag.taggedUserId = taggedUserId;
      return tag;
    });

    const explicitHashtags = dto.hashtags ?? [];
    const extractedHashtags = dto.description
      ? this.extractHashtags(dto.description)
      : [];

    const combinedHashtags = Array.from(
      new Set([...explicitHashtags, ...extractedHashtags]),
    );

    const textSlides = this.parseTextSlides(dto.textSlides);

    const post = this.postRepository.create({
      userId,
      schoolId: user.schoolId,
      description: dto.description,
      hashtags: combinedHashtags,
      type,
      status: dto.status ?? PostStatus.PUBLISHED,
      visibility: dto.visibility,
      commentPermission: dto.commentPermission,
      giftsEnabled: dto.giftsEnabled,
      category: dto.category,
      feeling: dto.feeling,
      location: dto.location,
      backgroundColor: dto.backgroundColor ?? null,
      textAlign: dto.textAlign ?? 'center',
      fontStyle: dto.fontStyle ?? 'classic',
      fontSize: dto.fontSize ?? 'medium',
      textSlides,
      media,
      tags,
    });

    const saved = await this.postRepository.save(post);
    if (saved.status === PostStatus.PUBLISHED) {
      await this.gamificationService.awardXp(
        userId,
        XpSource.POST_CREATED,
        20,
        saved.id,
      );
    }

    
    // Notify each tagged user
    if (tags.length > 0) {
      const actorName = user.username ?? 'Someone';
      for (const tag of tags) {
        await this.notificationsService.notify(
          tag.taggedUserId,
          userId,
          NotificationType.POST_TAGGED,
          NotificationTargetType.POST,
          saved.id,
          actorName,
        );
      }
    }

    const fullPost = await this.getPostOrThrow(saved.id);

    // Real-time broadcast post creation
    this.postsGateway.broadcastToFeed(
      PostWebSocketEvents.POST_CREATED,
      fullPost,
    );

    return saved;
  }

  async update(userId: string, id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException("You can only edit your own posts");
    }

    let combinedHashtags: string[] = [];

    if (dto.hashtags !== undefined) {
      combinedHashtags = [...dto.hashtags];
    } else {
      combinedHashtags = [...(post.hashtags || [])];
    }

    if (dto.description !== undefined) {
      const extracted = this.extractHashtags(dto.description);
      combinedHashtags = [...combinedHashtags, ...extracted];
    }

    post.hashtags = Array.from(new Set(combinedHashtags));

    Object.assign(post, dto);
    return this.postRepository.save(post);
  }

  async publish(userId: string, id: string): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException("You can only publish your own posts");
    }
    const wasDraft = post.status === PostStatus.DRAFT;
    post.status = PostStatus.PUBLISHED;
    const saved = await this.postRepository.save(post);
    if (wasDraft) {
      await this.gamificationService.awardXp(
        userId,
        XpSource.POST_CREATED,
        20,
        saved.id,
      );
    }
    return saved;
  }

  async getDrafts(userId: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { userId, status: PostStatus.DRAFT },
      order: { createdAt: "DESC" },
      relations: ["media", "tags"],
    });
  }

async findById(id: string, currentUserId?: string): Promise<Post> {
  return this.getPostOrThrow(id, currentUserId);
}

private async getPostOrThrow(id: string, currentUserId?: string): Promise<Post> {
  const qb = this.postRepository
    .createQueryBuilder("post")
    .leftJoinAndSelect("post.media", "media")
    .leftJoinAndSelect("post.tags", "tags")
    .leftJoin("post.user", "user")
    .leftJoin("user.department", "department")
    .leftJoin("user.faculty", "faculty")
    .leftJoin("user.school", "school")
    .addSelect([
      "user.id",
      "user.firstName",
      "user.lastName",
      "user.username",
      "user.profilePictureUrl",
      "user.departmentId",
      "user.facultyId",
      "user.schoolId",
      // Academic entity details
      "department.id",
      "department.name",
      "faculty.id",
      "faculty.name",
      "school.id",
      "school.name",
    ])
    .where("post.id = :id", { id });

  const post = await qb.getOne();

  if (!post) {
    throw new NotFoundException(`Post with ID "${id}" not found`);
  }

  // Populate contextual metadata if currentUserId is provided
  if (currentUserId) {
    const [like, reshare, isFollowingSet, userLevelStats] = await Promise.all([
      this.postLikeRepository.findOne({
        where: { userId: currentUserId, postId: post.id },
        select: ["postId"],
      }),
      this.reshareRepository.findOne({
        where: { userId: currentUserId, postId: post.id },
        select: ["postId"],
      }),
      post.user
        ? this.followsService.getFollowingIdsSet(currentUserId, [post.user.id])
        : Promise.resolve(new Set<string>()),
      post.user
        ? this.gamificationService.getMe(post.user.id)
        : Promise.resolve(null),
    ]);

    (post as any).isLiked = !!like;
    (post as any).isReshared = !!reshare;

    if (post.user) {
      (post.user as any).isFollowing = isFollowingSet.has(post.user.id);

      if (userLevelStats) {
        (post.user as any).appLevel = userLevelStats.level;
      }
    }
  }

  return post;
}

  async getGiftTarget(
    postId: string,
  ): Promise<{ recipientId: string; giftsEnabled: boolean }> {
    const post = await this.getPostOrThrow(postId);
    return { recipientId: post.userId, giftsEnabled: post.giftsEnabled };
  }

  async incrementGiftsCount(postId: string): Promise<void> {
    await this.postRepository.increment({ id: postId }, "giftsCount", 1);
  }

  async getGifters(ownerId: string, id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      giftName: string;
      coinsCost: number;
      giftedAt: Date;
      level: Level;
    }>
  > {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== ownerId) {
      throw new ForbiddenException('Only the post owner can see who has gifted this post');
    }

    const limit = pagination.limit ?? 20;
    const qb = this.giftTransactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.sender', 'sender')
      .leftJoin('transaction.gift', 'gift')
      // Select columns explicitly to exclude sender.password entirely
      .addSelect(['sender.id', 'sender.username', 'sender.profilePictureUrl', 'sender.profileFrame'])
      .addSelect(['gift.name'])
      .where('transaction.targetType = :targetType', { targetType: GiftTargetType.POST })
      .andWhere('transaction.targetId = :id', { id });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere(
        '(transaction.createdAt < :createdAt OR (transaction.createdAt = :createdAt AND transaction.id < :cursorId))',
        { createdAt, cursorId },
      );
    }

    qb.orderBy('transaction.createdAt', 'DESC').addOrderBy('transaction.id', 'DESC').take(limit + 1);

    const gifts = await qb.getMany();
    const hasMore = gifts.length > limit;
    const page = hasMore ? gifts.slice(0, limit) : gifts;
    const giftsOnly = page.filter((g) => g.sender);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(giftsOnly.map((g) => g.sender.id));

    const items = giftsOnly.map((g) => ({
      id: g.sender.id,
      username: g.sender.username,
      profilePictureUrl: g.sender.profilePictureUrl,
      profileFrame: g.sender.profileFrame,
      giftName: g.gift?.name ?? 'Gift',
      coinsCost: g.coinsCost,
      giftedAt: g.createdAt,
      level: levelByUserId.get(g.sender.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async recordView(userId: string, id: string): Promise<void> {
    const post = await this.getPostOrThrow(id);
    // The owner viewing their own post is not a "view" — don't inflate
    // viewsCount or have them show up in their own viewers list.
    if (userId === post.userId) return;

    const existing = await this.postViewRepository.findOne({ where: { postId: id, viewerId: userId } });
    if (!existing) {
      await this.postViewRepository.save(this.postViewRepository.create({ postId: id, viewerId: userId }));
      await this.postRepository.increment({ id }, 'viewsCount', 1);
    }
  }

  async getViewers(ownerId: string, id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      viewedAt: Date;
      level: Level;
    }>
  > {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== ownerId) {
      throw new ForbiddenException('Only the post owner can see who has viewed this post');
    }

    const limit = pagination.limit ?? 20;
    const qb = this.postViewRepository
      .createQueryBuilder('view')
      .leftJoin('view.viewer', 'viewer')
      // Select columns explicitly to exclude viewer.password entirely
      .addSelect(['viewer.id', 'viewer.username', 'viewer.profilePictureUrl', 'viewer.profileFrame'])
      .where('view.postId = :id', { id })
      .andWhere('view.viewerId != :ownerId', { ownerId });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere('(view.createdAt < :createdAt OR (view.createdAt = :createdAt AND view.id < :cursorId))', {
        createdAt,
        cursorId,
      });
    }

    qb.orderBy('view.createdAt', 'DESC').addOrderBy('view.id', 'DESC').take(limit + 1);

    const views = await qb.getMany();
    const hasMore = views.length > limit;
    const page = hasMore ? views.slice(0, limit) : views;
    const viewersOnly = page.filter((v) => v.viewer);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(viewersOnly.map((v) => v.viewer.id));

    const items = viewersOnly.map((v) => ({
      id: v.viewer.id,
      username: v.viewer.username,
      profilePictureUrl: v.viewer.profilePictureUrl,
      profileFrame: v.viewer.profileFrame,
      viewedAt: v.createdAt,
      level: levelByUserId.get(v.viewer.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getLikers(id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      likedAt: Date;
      level: Level;
    }>
  > {
    await this.getPostOrThrow(id);

    const limit = pagination.limit ?? 20;
    const qb = this.postLikeRepository
      .createQueryBuilder('like')
      .leftJoin('like.user', 'user')
      // Select columns explicitly to exclude user.password entirely
      .addSelect(['user.id', 'user.username', 'user.profilePictureUrl', 'user.profileFrame'])
      .where('like.postId = :id', { id });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere('(like.createdAt < :createdAt OR (like.createdAt = :createdAt AND like.id < :cursorId))', {
        createdAt,
        cursorId,
      });
    }

    qb.orderBy('like.createdAt', 'DESC').addOrderBy('like.id', 'DESC').take(limit + 1);

    const likes = await qb.getMany();
    const hasMore = likes.length > limit;
    const page = hasMore ? likes.slice(0, limit) : likes;
    const likesOnly = page.filter((l) => l.user);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(likesOnly.map((l) => l.user.id));

    const items = likesOnly.map((l) => ({
      id: l.user.id,
      username: l.user.username,
      profilePictureUrl: l.user.profilePictureUrl,
      profileFrame: l.user.profileFrame,
      likedAt: l.createdAt,
      level: levelByUserId.get(l.user.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException("You can only delete your own posts");
    }
    await this.postRepository.remove(post);
    // Real-time broadcast post removal
    this.postsGateway.broadcastToFeed(PostWebSocketEvents.POST_DELETED, {
      postId: id,
    });
  }

  async hide(userId: string, id: string): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException("You can only hide your own posts");
    }
    post.isHidden = true;
    return this.postRepository.save(post);
  }

  async unhide(userId: string, id: string): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException("You can only unhide your own posts");
    }
    post.isHidden = false;
    return this.postRepository.save(post);
  }

  // --- User Collection Endpoints ---

  async getMyPosts(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<Post>> {
    const limit = pagination.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.media", "media")
      .leftJoinAndSelect("post.tags", "tags")
      .where("post.userId = :userId", { userId })
      .andWhere("post.status = :status", { status: PostStatus.PUBLISHED });

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("post.createdAt", "DESC")
      .addOrderBy("post.id", "DESC")
      .take(limit + 1);

    const posts = await qb.getMany();
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getHiddenPosts(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<Post>> {
    const limit = pagination.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.media", "media")
      .where("post.userId = :userId", { userId })
      .andWhere("post.isHidden = true");

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("post.createdAt", "DESC")
      .addOrderBy("post.id", "DESC")
      .take(limit + 1);

    const posts = await qb.getMany();
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getTaggedPosts(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<Post>> {
    const limit = pagination.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder("post")
      .innerJoin("post.tags", "tag", "tag.taggedUserId = :userId", { userId })
      .leftJoinAndSelect("post.media", "media")
      .leftJoinAndSelect("post.user", "user")
      .where("post.status = :status", { status: PostStatus.PUBLISHED })
      .andWhere("post.isHidden = false");

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("post.createdAt", "DESC")
      .addOrderBy("post.id", "DESC")
      .take(limit + 1);

    const posts = await qb.getMany();
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getFavorites(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<PostFavorite>> {
    const limit = pagination.limit ?? 20;

    const qb = this.favoriteRepository
      .createQueryBuilder("favorite")
      .leftJoinAndSelect("favorite.post", "post")
      .leftJoinAndSelect("post.media", "media")
      .leftJoinAndSelect("post.user", "user")
      .where("favorite.userId = :userId", { userId });

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(favorite.createdAt < :createdAt OR (favorite.createdAt = :createdAt AND favorite.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("favorite.createdAt", "DESC")
      .addOrderBy("favorite.id", "DESC")
      .take(limit + 1);

    const favorites = await qb.getMany();
    const hasMore = favorites.length > limit;
    const items = hasMore ? favorites.slice(0, limit) : favorites;
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getReshares(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<PostReshare>> {
    const limit = pagination.limit ?? 20;

    const qb = this.reshareRepository
      .createQueryBuilder("reshare")
      .leftJoinAndSelect("reshare.post", "post")
      .leftJoinAndSelect("post.media", "media")
      .leftJoinAndSelect("post.user", "user")
      .where("reshare.userId = :userId", { userId })
      .andWhere("post.status = :status", { status: PostStatus.PUBLISHED })
      .andWhere("post.isHidden = false");

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(reshare.createdAt < :createdAt OR (reshare.createdAt = :createdAt AND reshare.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("reshare.createdAt", "DESC")
      .addOrderBy("reshare.id", "DESC")
      .take(limit + 1);

    const reshares = await qb.getMany();
    const hasMore = reshares.length > limit;
    const items = hasMore ? reshares.slice(0, limit) : reshares;
    const last = items[items.length - 1];

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  // --- Feed ---

async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<CursorPaginated<Post>> {
    const tab = query.tab ?? FeedTab.FOR_YOU;
    const limit = query.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.media", "media")
      .leftJoin("post.user", "user")
      .leftJoin("user.department", "department")
      .leftJoin("user.faculty", "faculty")
      .leftJoin("user.school", "school")
      .addSelect([
        "user.id",
        "user.firstName",
        "user.lastName",
        "user.username",
        "user.profilePictureUrl",
        "user.departmentId",
        "user.facultyId",
        "user.schoolId",
        // Academic entity details
        "department.id",
        "department.name",
        "faculty.id",
        "faculty.name",
        "school.id",
        "school.name",
      ])
      .where("post.status = :status", { status: PostStatus.PUBLISHED })
      .andWhere("post.isHidden = false");

    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);
    if (blockedUserIds.length > 0) {
      qb.andWhere("post.userId NOT IN (:...blockedUserIds)", {
        blockedUserIds,
      });
    }

    if (tab === FeedTab.CAMPUS) {
      const user = await this.usersService.findById(userId);
      qb.andWhere("post.schoolId = :schoolId", {
        schoolId: user?.schoolId ?? null,
      });
    } else if (tab === FeedTab.FOLLOWING) {
      // Fix: Extract items array from PaginatedFollowResponse
      const followingResponse = await this.followsService.getFollowing(userId);
      const followingList = followingResponse.items ?? []; // Adjust `.items` if property name differs (e.g., .data)

      const followingIds = followingList.map((f) => f.id);
      if (followingIds.length === 0) {
        return { items: [], nextCursor: null };
      }
      qb.andWhere("post.userId IN (:...followingIds)", { followingIds });
    }

    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere(
        "(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))",
        { createdAt, id },
      );
    }

    qb.orderBy("post.createdAt", "DESC")
      .addOrderBy("post.id", "DESC")
      .take(limit + 1);

    const posts = await qb.getMany();

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const last = items[items.length - 1];

    if (items.length > 0) {
      const postIds = items.map((post) => post.id);

      // 1. Batch check likes
      const userLikes = await this.postLikeRepository.find({
        where: {
          userId,
          postId: In(postIds),
        },
        select: ["postId"],
      });
      const likedPostIds = new Set(userLikes.map((like) => like.postId));

      // 1b. Batch check reshares
      const userReshares = await this.reshareRepository.find({
        where: {
          userId,
          postId: In(postIds),
        },
        select: ["postId"],
      });
      const resharedPostIds = new Set(
        userReshares.map((reshare) => reshare.postId),
      );

      // 2. Extract author IDs
      const userIds = [
        ...new Set(items.map((post) => post.user?.id).filter(Boolean)),
      ];

      // 3. Batch check follow status & fetch gamification levels
      const [followingIdsSet, levelMapArray] = await Promise.all([
        this.followsService.getFollowingIdsSet(userId, userIds),
        // If your gamificationService supports batching, use a single query here.
        // Fallback to Promise.all if single fetch isn't supported yet.
        Promise.all(
          userIds.map(async (id) => {
            const stats = await this.gamificationService.getMe(id);
            return { id, level: stats.level };
          }),
        ),
      ]);

      const levelLookup = Object.fromEntries(
        levelMapArray.map((x) => [x.id, x.level]),
      );

      // 4. Attach computed properties (`isLiked`, `isReshared`, `isFollowing`, & `appLevel`)
      items.forEach((post) => {
        (post as any).isLiked = likedPostIds.has(post.id);
        (post as any).isReshared = resharedPostIds.has(post.id);

        if (post.user) {
          const isFollowingAuthor = followingIdsSet.has(post.user.id);

          (post.user as any).isFollowing = isFollowingAuthor;

          if (levelLookup[post.user.id]) {
            (post.user as any).appLevel = levelLookup[post.user.id];
          }
        }
      });
    }

    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return {
      items,
      nextCursor,
    };
  }

  /**
   * Get all public video posts published by a specific user.
   */
  async getUserPublicVideos(
    userId: string,
    paginationDto: CursorPaginationDto,
  ): Promise<CursorPaginated<Post>> {
    const { limit = 10, cursor } = paginationDto;

    const query = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.media", "media")
      .leftJoinAndSelect("post.tags", "tags")
      .leftJoinAndSelect("post.user", "user")
      .where("post.userId = :userId", { userId })
      .andWhere("post.status = :status", { status: PostStatus.PUBLISHED })
      .andWhere("post.type IN (:...videoTypes)", {
        videoTypes: [PostType.VIDEO, PostType.MIXED],
      })
      .orderBy("post.createdAt", "DESC");

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        query.andWhere(
          "(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))",
          {
            createdAt: decoded.createdAt,
            id: decoded.id,
          },
        );
      }
    }

    query.take(limit + 1);

    const items = await query.getMany();
    const hasNextPage = items.length > limit;

    if (hasNextPage) {
      items.pop();
    }

    const nextCursor =
      hasNextPage && items.length > 0
        ? encodeCursor(
            items[items.length - 1].createdAt,
            items[items.length - 1].id,
          )
        : null;

    return {
      items,
      nextCursor,
    } as CursorPaginated<Post>;
  }

  // --- Likes ---

  async likePost(userId: string, postId: string): Promise<void> {
    const post = await this.getPostOrThrow(postId);
    const existing = await this.postLikeRepository.findOne({
      where: { postId, userId },
    });
    if (existing) return;

    await this.postLikeRepository.save(
      this.postLikeRepository.create({ postId, userId }),
    );
    await this.postRepository.increment({ id: postId }, "likesCount", 1);
    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      postId,
    );
    await this.gamificationService.awardXp(
      post.userId,
      XpSource.LIKE_RECEIVED,
      1,
      postId,
    );

    const payload = { postId, likesCount: post.likesCount + 1, userId };
    this.postsGateway.broadcastToFeed(PostWebSocketEvents.POST_LIKED, payload);
    this.postsGateway.broadcastToPostRoom(
      postId,
      PostWebSocketEvents.POST_LIKED,
      payload,
    );
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const like = await this.postLikeRepository.findOne({
      where: { postId, userId },
    });
    if (!like) return;

    await this.postLikeRepository.remove(like);
    await this.postRepository.decrement({ id: postId }, "likesCount", 1);

    const post = await this.getPostOrThrow(postId);
    const payload = {
      postId,
      likesCount: Math.max(0, post.likesCount - 1),
      userId,
    };

    this.postsGateway.broadcastToFeed(
      PostWebSocketEvents.POST_UNLIKED,
      payload,
    );
    this.postsGateway.broadcastToPostRoom(
      postId,
      PostWebSocketEvents.POST_UNLIKED,
      payload,
    );
  }

  // --- Comments ---

  private async checkCommentPermission(
    post: Post,
    callerId: string,
  ): Promise<void> {
    if (post.userId === callerId) return;

    if (await this.followsService.isBlocked(post.userId, callerId)) {
      throw new ForbiddenException("You cannot comment on this post");
    }
    if (post.commentPermission === CommentPermission.NOBODY) {
      throw new ForbiddenException("Comments are disabled on this post");
    }
    if (post.commentPermission === CommentPermission.FOLLOWERS_ONLY) {
      const isFollower = await this.followsService.isFollowing(
        callerId,
        post.userId,
      );
      if (!isFollower) {
        throw new ForbiddenException("Only followers of this user can comment");
      }
    }
  }

  // --- Comments ---

  async addComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<PostComment> {
    const post = await this.getPostOrThrow(postId);
    await this.checkCommentPermission(post, userId);

    if (dto.parentCommentId) {
      await this.getCommentOrThrow(dto.parentCommentId);
    }

    const comment = this.commentRepository.create({
      postId,
      userId,
      text: dto.text,
      parentCommentId: dto.parentCommentId,
    });

    const saved = await this.commentRepository.save(comment);
    await this.postRepository.increment({ id: postId }, "commentsCount", 1);

    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_COMMENTED,
      NotificationTargetType.POST,
      postId,
      undefined,
      undefined,
      undefined,
      saved.id,
    );

    // If replying to someone else's comment, also notify the parent comment author
    if (dto.parentCommentId) {
      const parentComment = await this.getCommentOrThrow(dto.parentCommentId);
      if (parentComment.userId !== userId) {
        await this.notificationsService.notify(
          parentComment.userId,
          userId,
          NotificationType.COMMENT_REPLIED,
          NotificationTargetType.POST,
          postId,
          undefined,
          undefined,
          undefined,
          saved.id,
        );
      }
    }

    await this.gamificationService.awardXp(
      post.userId,
      XpSource.COMMENT_RECEIVED,
      3,
      postId,
    );

    const savedComment = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: { user: true },
      select: {
        id: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        parentCommentId: true,
        user: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          profilePictureUrl: true,
        },
      },
    });

    if (!savedComment) {
      throw new NotFoundException(
        `Comment with ID "${saved.id}" not found after save`,
      );
    }

    (savedComment as any).repliesCount = 0;
    (savedComment as any).isLiked = false;

    const newCommentsCount = post.commentsCount + 1;

    this.postsGateway.broadcastToPostRoom(
      postId,
      PostWebSocketEvents.COMMENT_ADDED,
      { postId, comment: savedComment },
    );
    this.postsGateway.broadcastToFeed(PostWebSocketEvents.COMMENT_ADDED, {
      postId,
      commentsCount: newCommentsCount,
    });

    return savedComment;
  }

  async replyToComment(
    userId: string,
    commentId: string,
    dto: CreateCommentDto,
  ): Promise<PostComment> {
    const parent = await this.getCommentOrThrow(commentId);
    return this.addComment(userId, parent.postId, {
      ...dto,
      parentCommentId: commentId,
    });
  }

  async getComments(
    userId: string,
    postId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<PostComment>> {
    const limit = pagination.limit ?? 20;

    const qb = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.user", "user")
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.parentCommentId IS NULL")
      .select([
        "comment.id",
        "comment.postId",
        "comment.userId",
        "comment.text",
        "comment.parentCommentId",
        "comment.likesCount",
        "comment.createdAt",
        "comment.updatedAt",

        "user.id",
        "user.firstName",
        "user.lastName",
        "user.username",
        "user.profilePictureUrl",
        "user.profileFrame",
      ])
      .leftJoin(
        CommentLike,
        "commentLike",
        "commentLike.commentId = comment.id AND commentLike.userId = :userId",
        { userId },
      )
      .addSelect("COUNT(commentLike.id) > 0", "comment_isLiked")
      .loadRelationCountAndMap("comment.repliesCount", "comment.replies");

    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);
    if (blockedUserIds.length > 0) {
      qb.andWhere("comment.userId NOT IN (:...blockedUserIds)", {
        blockedUserIds,
      });
    }

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(comment.createdAt < :createdAt OR (comment.createdAt = :createdAt AND comment.id < :id))",
        {
          createdAt,
          id,
        },
      );
    }

    qb.groupBy("comment.id").addGroupBy("user.id");

    qb.orderBy("comment.createdAt", "DESC")
      .addOrderBy("comment.id", "DESC")
      .take(limit + 1);

    const { entities, raw } = await qb.getRawAndEntities();

    const fullPage = entities.map((entity, index) => {
      const rawLiked = raw[index]?.comment_isLiked;
      (entity as any).isLiked =
        rawLiked === true || rawLiked === "1" || parseInt(rawLiked) > 0;
      return entity;
    });

    const hasMore = fullPage.length > limit;
    const items = hasMore ? fullPage.slice(0, limit) : fullPage;
    const last = items[items.length - 1];

    const commenterIds = [
      ...new Set(items.map((c) => c.user?.id).filter(Boolean)),
    ];
    if (commenterIds.length > 0) {
      const levelMapArray = await Promise.all(
        commenterIds.map(async (id) => {
          const stats = await this.gamificationService.getMe(id);
          return { id, level: stats.level };
        }),
      );
      const levelLookup = Object.fromEntries(
        levelMapArray.map((x) => [x.id, x.level]),
      );
      items.forEach((c) => {
        if (c.user && levelLookup[c.user.id]) {
          (c.user as any).appLevel = levelLookup[c.user.id];
        }
      });
    }

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getReplies(
    userId: string,
    commentId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<PostComment>> {
    const limit = pagination.limit ?? 20;

    await this.getCommentOrThrow(commentId);

    const qb = this.commentRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.user", "user")
      .where("comment.parentCommentId = :commentId", { commentId })
      .select([
        "comment.id",
        "comment.postId",
        "comment.userId",
        "comment.text",
        "comment.parentCommentId",
        "comment.likesCount",
        "comment.createdAt",
        "comment.updatedAt",

        "user.id",
        "user.firstName",
        "user.lastName",
        "user.username",
        "user.profilePictureUrl",
        "user.profileFrame",
      ])
      .leftJoin(
        CommentLike,
        "commentLike",
        "commentLike.commentId = comment.id AND commentLike.userId = :userId",
        { userId },
      )
      .addSelect("COUNT(commentLike.id) > 0", "comment_isLiked");

    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);
    if (blockedUserIds.length > 0) {
      qb.andWhere("comment.userId NOT IN (:...blockedUserIds)", {
        blockedUserIds,
      });
    }

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        "(comment.createdAt < :createdAt OR (comment.createdAt = :createdAt AND comment.id < :id))",
        { createdAt, id },
      );
    }

    qb.groupBy("comment.id").addGroupBy("user.id");

    qb.orderBy("comment.createdAt", "ASC")
      .addOrderBy("comment.id", "ASC")
      .take(limit + 1);

    const { entities, raw } = await qb.getRawAndEntities();

    const fullPage = entities.map((entity, index) => {
      const rawLiked = raw[index]?.comment_isLiked;
      (entity as any).isLiked =
        rawLiked === true || rawLiked === "1" || parseInt(rawLiked) > 0;
      return entity;
    });

    const hasMore = fullPage.length > limit;
    const items = hasMore ? fullPage.slice(0, limit) : fullPage;
    const last = items[items.length - 1];

    const replierIds = [
      ...new Set(items.map((r) => r.user?.id).filter(Boolean)),
    ];
    if (replierIds.length > 0) {
      const levelMapArray = await Promise.all(
        replierIds.map(async (id) => {
          const stats = await this.gamificationService.getMe(id);
          return { id, level: stats.level };
        }),
      );
      const levelLookup = Object.fromEntries(
        levelMapArray.map((x) => [x.id, x.level]),
      );
      items.forEach((r) => {
        if (r.user && levelLookup[r.user.id]) {
          (r.user as any).appLevel = levelLookup[r.user.id];
        }
      });
    }

    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.getCommentOrThrow(commentId);
    const post = await this.getPostOrThrow(comment.postId);

    if (comment.userId !== userId && post.userId !== userId) {
      throw new ForbiddenException(
        "Only the comment author or the post owner can delete this comment",
      );
    }

    await this.commentRepository.remove(comment);
    await this.postRepository.decrement(
      { id: comment.postId },
      "commentsCount",
      1,
    );
  }

  async likeComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.getCommentOrThrow(commentId);
    const existing = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    if (existing) return;

    await this.commentLikeRepository.save(
      this.commentLikeRepository.create({ commentId, userId }),
    );
    await this.commentRepository.increment({ id: commentId }, "likesCount", 1);
    await this.notificationsService.notify(
      comment.userId,
      userId,
      NotificationType.COMMENT_LIKED,
      NotificationTargetType.POST,
      comment.postId,
      undefined,
      undefined,
      undefined,
      commentId,
    );
  }

  async unlikeComment(userId: string, commentId: string): Promise<void> {
    const like = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    if (!like) return;

    await this.commentLikeRepository.remove(like);
    await this.commentRepository.decrement({ id: commentId }, "likesCount", 1);
  }

  // --- Reshare / Favorite ---

  async reshare(
    userId: string,
    postId: string,
    comment?: string,
  ): Promise<PostReshare> {
    const post = await this.getPostOrThrow(postId);
    const existing = await this.reshareRepository.findOne({
      where: { postId, userId },
    });
    if (existing) {
      throw new BadRequestException("You already reshared this post");
    }

    const saved = await this.reshareRepository.save(
      this.reshareRepository.create({ postId, userId, comment }),
    );
    await this.postRepository.increment({ id: postId }, "resharesCount", 1);
    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_RESHARED,
      NotificationTargetType.POST,
      postId,
    );
    await this.gamificationService.awardXp(
      post.userId,
      XpSource.RESHARE_RECEIVED,
      5,
      postId,
    );
    return saved;
  }

  async favorite(userId: string, postId: string): Promise<void> {
    await this.getPostOrThrow(postId);
    const existing = await this.favoriteRepository.findOne({
      where: { postId, userId },
    });
    if (existing) return;
    await this.favoriteRepository.save(
      this.favoriteRepository.create({ postId, userId }),
    );
  }

  async unfavorite(userId: string, postId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { postId, userId },
    });
    if (!favorite) return;
    await this.favoriteRepository.remove(favorite);
  }

  // --- Reports ---

  async reportPost(
    userId: string,
    postId: string,
    reason: string,
  ): Promise<ContentReport> {
    await this.getPostOrThrow(postId);
    const report = this.reportRepository.create({
      reporterId: userId,
      targetType: ReportTargetType.POST,
      targetId: postId,
      reason,
    });
    const saved = await this.reportRepository.save(report);
    await this.postRepository.update({ id: postId }, { isReported: true });
    return saved;
  }

  async reportComment(
    userId: string,
    commentId: string,
    reason: string,
  ): Promise<ContentReport> {
    await this.getCommentOrThrow(commentId);
    const report = this.reportRepository.create({
      reporterId: userId,
      targetType: ReportTargetType.COMMENT,
      targetId: commentId,
      reason,
    });
    return this.reportRepository.save(report);
  }



  async findUserProfileById(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) return null;

    let level = 1;
    let appLevel = null;

    try {
      const stats = await this.gamificationService.getMe(userId);
      if (stats?.level) {
        level = stats.level.level ?? 1;
        appLevel = stats.level;
      }
    } catch {
      // Fallback defaults if gamification record doesn't exist yet
    }

    return {
      ...user,
      level,
      appLevel,
    };
  }
}
