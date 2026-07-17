import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, PostStatus, PostType, CommentPermission } from './entities/post.entity';
import { PostMedia, PostMediaType } from './entities/post-media.entity';
import { PostTag } from './entities/post-tag.entity';
import { PostLike } from './entities/post-like.entity';
import { PostComment } from './entities/post-comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { PostReshare } from './entities/post-reshare.entity';
import { PostFavorite } from './entities/post-favorite.entity';
import { ContentReport, ReportTargetType } from './entities/content-report.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedQueryDto, FeedTab } from './dto/feed-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '../gamification/entities/xp-transaction.entity';
import { FollowsService } from '../follows/follows.service';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

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
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly gamificationService: GamificationService,
    private readonly followsService: FollowsService,
  ) {}

  private extractHashtags(description?: string): string[] {
    if (!description) return [];
    const matches = description.match(HASHTAG_REGEX) ?? [];
    return [...new Set(matches)];
  }

  private async getPostOrThrow(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id }, relations: ['media', 'tags'] });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    return post;
  }

  private async getCommentOrThrow(id: string): Promise<PostComment> {
    const comment = await this.commentRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID "${id}" not found`);
    }
    return comment;
  }

  async create(userId: string, dto: CreatePostDto, files: Express.Multer.File[]): Promise<Post> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const media: PostMedia[] = [];
    for (const [index, file] of files.entries()) {
      const isVideo = file.mimetype.startsWith('video/');
      const result = await this.cloudinaryService.uploadFile(file, {
        folder: 'posts',
        resourceType: isVideo ? 'video' : 'image',
        transformation: [isVideo ? { crop: 'limit', width: 720 } : { crop: 'fill', width: 1080 }],
      });
      const item = new PostMedia();
      item.url = result.secure_url;
      // Video thumbnails need a separate eager poster-frame transformation from Cloudinary;
      // left unset for v1 rather than adding that complexity before it's needed.
      item.thumbnailUrl = isVideo ? null : result.secure_url;
      item.mediaType = isVideo ? PostMediaType.VIDEO : PostMediaType.IMAGE;
      item.order = index;
      media.push(item);
    }

    let type = PostType.TEXT;
    if (media.length > 0) {
      const hasImage = media.some((m) => m.mediaType === PostMediaType.IMAGE);
      const hasVideo = media.some((m) => m.mediaType === PostMediaType.VIDEO);
      type = hasImage && hasVideo ? PostType.MIXED : hasVideo ? PostType.VIDEO : PostType.IMAGE;
    }

    const tags = (dto.taggedUserIds ?? []).map((taggedUserId) => {
      const tag = new PostTag();
      tag.taggedUserId = taggedUserId;
      return tag;
    });

    const post = this.postRepository.create({
      userId,
      schoolId: user.schoolId,
      description: dto.description,
      hashtags: this.extractHashtags(dto.description),
      type,
      status: dto.status ?? PostStatus.PUBLISHED,
      visibility: dto.visibility,
      commentPermission: dto.commentPermission,
      giftsEnabled: dto.giftsEnabled,
      category: dto.category,
      feeling: dto.feeling,
      location: dto.location,
      media,
      tags,
    });

    const saved = await this.postRepository.save(post);
    if (saved.status === PostStatus.PUBLISHED) {
      await this.gamificationService.awardXp(userId, XpSource.POST_CREATED, 20, saved.id);
    }
    return saved;
  }

  async update(userId: string, id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (dto.description !== undefined) {
      post.hashtags = this.extractHashtags(dto.description);
    }

    Object.assign(post, dto);
    return this.postRepository.save(post);
  }

  async publish(userId: string, id: string): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('You can only publish your own posts');
    }
    const wasDraft = post.status === PostStatus.DRAFT;
    post.status = PostStatus.PUBLISHED;
    const saved = await this.postRepository.save(post);
    if (wasDraft) {
      await this.gamificationService.awardXp(userId, XpSource.POST_CREATED, 20, saved.id);
    }
    return saved;
  }

  async getDrafts(userId: string): Promise<Post[]> {
    return this.postRepository.find({
      where: { userId, status: PostStatus.DRAFT },
      order: { createdAt: 'DESC' },
      relations: ['media'],
    });
  }

  async findById(id: string): Promise<Post> {
    return this.getPostOrThrow(id);
  }

  /** Used by GiftsService (Phase 4) to check eligibility and find the recipient. */
  async getGiftTarget(postId: string): Promise<{ recipientId: string; giftsEnabled: boolean }> {
    const post = await this.getPostOrThrow(postId);
    return { recipientId: post.userId, giftsEnabled: post.giftsEnabled };
  }

  async incrementGiftsCount(postId: string): Promise<void> {
    await this.postRepository.increment({ id: postId }, 'giftsCount', 1);
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.postRepository.remove(post);
  }

  async hide(userId: string, id: string): Promise<Post> {
    const post = await this.getPostOrThrow(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('You can only hide your own posts');
    }
    post.isHidden = true;
    return this.postRepository.save(post);
  }

  // --- Feed ---

  async getFeed(userId: string, query: FeedQueryDto): Promise<CursorPaginated<Post>> {
    const tab = query.tab ?? FeedTab.FOR_YOU;
    const limit = query.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.media', 'media')
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere('post.isHidden = false');

    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);
    if (blockedUserIds.length > 0) {
      qb.andWhere('post.userId NOT IN (:...blockedUserIds)', { blockedUserIds });
    }

    if (tab === FeedTab.CAMPUS) {
      const user = await this.usersService.findById(userId);
      qb.andWhere('post.schoolId = :schoolId', { schoolId: user?.schoolId ?? null });
    } else if (tab === FeedTab.FOLLOWING) {
      const following = await this.followsService.getFollowing(userId);
      const followingIds = following.map((f) => f.followingId);
      if (followingIds.length === 0) {
        return { items: [], nextCursor: null };
      }
      qb.andWhere('post.userId IN (:...followingIds)', { followingIds });
    }

    // v1 "For You" ranking is recency-only. A recency+engagement blend was considered
    // (see plan), but a non-monotonic sort key breaks keyset pagination correctness
    // (a post can jump pages between requests) — not worth it for a v1 explicitly
    // documented as naive ranking. Revisit with a score-snapshot cursor if needed.
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere('(post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id))', {
        createdAt,
        id,
      });
    }

    qb.orderBy('post.createdAt', 'DESC').addOrderBy('post.id', 'DESC').take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    return {
      items: page,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  // --- Likes ---

  async likePost(userId: string, postId: string): Promise<void> {
    const post = await this.getPostOrThrow(postId);
    const existing = await this.postLikeRepository.findOne({ where: { postId, userId } });
    if (existing) return;

    await this.postLikeRepository.save(this.postLikeRepository.create({ postId, userId }));
    await this.postRepository.increment({ id: postId }, 'likesCount', 1);
    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_LIKED,
      NotificationTargetType.POST,
      postId,
    );
    await this.gamificationService.awardXp(post.userId, XpSource.LIKE_RECEIVED, 1, postId);
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const like = await this.postLikeRepository.findOne({ where: { postId, userId } });
    if (!like) return;

    await this.postLikeRepository.remove(like);
    await this.postRepository.decrement({ id: postId }, 'likesCount', 1);
  }

  // --- Comments ---

  private async checkCommentPermission(post: Post, callerId: string): Promise<void> {
    if (post.userId === callerId) return;

    if (await this.followsService.isBlocked(post.userId, callerId)) {
      throw new ForbiddenException('You cannot comment on this post');
    }
    if (post.commentPermission === CommentPermission.NOBODY) {
      throw new ForbiddenException('Comments are disabled on this post');
    }
    if (post.commentPermission === CommentPermission.FOLLOWERS_ONLY) {
      const isFollower = await this.followsService.isFollowing(callerId, post.userId);
      if (!isFollower) {
        throw new ForbiddenException('Only followers of this user can comment');
      }
    }
  }

  async addComment(userId: string, postId: string, dto: CreateCommentDto): Promise<PostComment> {
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
    await this.postRepository.increment({ id: postId }, 'commentsCount', 1);
    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_COMMENTED,
      NotificationTargetType.POST,
      postId,
    );
    await this.gamificationService.awardXp(post.userId, XpSource.COMMENT_RECEIVED, 3, postId);
    return saved;
  }

  async replyToComment(userId: string, commentId: string, dto: CreateCommentDto): Promise<PostComment> {
    const parent = await this.getCommentOrThrow(commentId);
    return this.addComment(userId, parent.postId, { ...dto, parentCommentId: commentId });
  }

  async getComments(
    userId: string,
    postId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<PostComment>> {
    const limit = pagination.limit ?? 20;
    const qb = this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.postId = :postId', { postId });

    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);
    if (blockedUserIds.length > 0) {
      qb.andWhere('comment.userId NOT IN (:...blockedUserIds)', { blockedUserIds });
    }

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere('(comment.createdAt < :createdAt OR (comment.createdAt = :createdAt AND comment.id < :id))', {
        createdAt,
        id,
      });
    }

    qb.orderBy('comment.createdAt', 'DESC').addOrderBy('comment.id', 'DESC').take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    return {
      items: page,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.getCommentOrThrow(commentId);
    const post = await this.getPostOrThrow(comment.postId);

    if (comment.userId !== userId && post.userId !== userId) {
      throw new ForbiddenException('Only the comment author or the post owner can delete this comment');
    }

    await this.commentRepository.remove(comment);
    await this.postRepository.decrement({ id: comment.postId }, 'commentsCount', 1);
  }

  async likeComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.getCommentOrThrow(commentId);
    const existing = await this.commentLikeRepository.findOne({ where: { commentId, userId } });
    if (existing) return;

    await this.commentLikeRepository.save(this.commentLikeRepository.create({ commentId, userId }));
    await this.commentRepository.increment({ id: commentId }, 'likesCount', 1);
    await this.notificationsService.notify(
      comment.userId,
      userId,
      NotificationType.COMMENT_LIKED,
      NotificationTargetType.COMMENT,
      commentId,
    );
  }

  async unlikeComment(userId: string, commentId: string): Promise<void> {
    const like = await this.commentLikeRepository.findOne({ where: { commentId, userId } });
    if (!like) return;

    await this.commentLikeRepository.remove(like);
    await this.commentRepository.decrement({ id: commentId }, 'likesCount', 1);
  }

  // --- Reshare / Favorite ---

  async reshare(userId: string, postId: string, comment?: string): Promise<PostReshare> {
    const post = await this.getPostOrThrow(postId);
    const existing = await this.reshareRepository.findOne({ where: { postId, userId } });
    if (existing) {
      throw new BadRequestException('You already reshared this post');
    }

    const saved = await this.reshareRepository.save(this.reshareRepository.create({ postId, userId, comment }));
    await this.postRepository.increment({ id: postId }, 'resharesCount', 1);
    await this.notificationsService.notify(
      post.userId,
      userId,
      NotificationType.POST_RESHARED,
      NotificationTargetType.POST,
      postId,
    );
    await this.gamificationService.awardXp(post.userId, XpSource.RESHARE_RECEIVED, 5, postId);
    return saved;
  }

  async favorite(userId: string, postId: string): Promise<void> {
    await this.getPostOrThrow(postId);
    const existing = await this.favoriteRepository.findOne({ where: { postId, userId } });
    if (existing) return;
    await this.favoriteRepository.save(this.favoriteRepository.create({ postId, userId }));
  }

  async unfavorite(userId: string, postId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({ where: { postId, userId } });
    if (!favorite) return;
    await this.favoriteRepository.remove(favorite);
  }

  // --- Reports ---

  async reportPost(userId: string, postId: string, reason: string): Promise<ContentReport> {
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

  async reportComment(userId: string, commentId: string, reason: string): Promise<ContentReport> {
    await this.getCommentOrThrow(commentId);
    const report = this.reportRepository.create({
      reporterId: userId,
      targetType: ReportTargetType.COMMENT,
      targetId: commentId,
      reason,
    });
    return this.reportRepository.save(report);
  }
}
