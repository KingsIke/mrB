import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Group, GroupType } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupMessage } from './entities/group-message.entity';
import { MessageAttachment, AttachmentType } from './entities/message-attachment.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CloudinaryService, CloudinaryResourceType } from '../cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';
import { resolveAttachmentType } from '../common/multer/message-attachment-upload.config';
import { CursorPaginated, CursorPaginationDto, decodeCursor, encodeCursor } from '../common/pagination/cursor-pagination.dto';
import { GroupsService } from './groups.service';
import { GroupsGateway, GroupWebSocketEvents } from './groups.gateway';

const EDIT_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    @InjectRepository(GroupMessage)
    private readonly messageRepository: Repository<GroupMessage>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
    private readonly groupsService: GroupsService,
    private readonly groupsGateway: GroupsGateway,
  ) {}

private async getMessageOrThrow(messageId: string, currentUserId?: string): Promise<GroupMessage> {
  const message = await this.messageRepository.findOne({
    where: { id: messageId },
    relations: {
      attachments: true,
      user: true,
      reactions: true,
      replyTo: { user: true, attachments: true },
    },
  });

  if (!message) {
    throw new NotFoundException(`Message with ID "${messageId}" not found`);
  }

  if (currentUserId && message.reactions) {
    const summaryMap = new Map<string, number>();
    for (const reaction of message.reactions) {
      summaryMap.set(reaction.emoji, (summaryMap.get(reaction.emoji) ?? 0) + 1);
    }

    (message as any).reactionSummary = Array.from(summaryMap.entries()).map(([emoji, count]) => ({
      emoji,
      count,
      reactedByMe: message.reactions.some((r) => r.emoji === emoji && r.userId === currentUserId),
    }));
  }

  return message;
}

  private buildUploadOptions(type: AttachmentType): {
    folder: string;
    resourceType: CloudinaryResourceType;
    transformation?: Record<string, string | number>[];
  } {
    switch (type) {
      case AttachmentType.IMAGE:
        return {
          folder: 'group-messages/images',
          resourceType: 'image',
          transformation: [{ crop: 'limit', width: 1080 }],
        };
      case AttachmentType.VIDEO:
        return {
          folder: 'group-messages/videos',
          resourceType: 'video',
          transformation: [{ crop: 'limit', width: 720 }],
        };
      case AttachmentType.AUDIO:
        return { folder: 'group-messages/audio', resourceType: 'video' };
      case AttachmentType.FILE:
      default:
        return { folder: 'group-messages/files', resourceType: 'auto' };
    }
  }

  async sendMessage(
    userId: string,
    groupId: string,
    dto: SendMessageDto,
    files: Express.Multer.File[] = [],
  ): Promise<GroupMessage> {
    const group = await this.groupsService.getGroupOrThrow(groupId);
    const isMember = await this.groupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (group.isLocked) {
      const isAdmin = await this.groupsService.isAdmin(groupId, userId);
      if (!isAdmin) {
        throw new ForbiddenException('This group is locked; only admins can post');
      }
    }

    if (!dto.content?.trim() && files.length === 0) {
      throw new BadRequestException('Message must have content or an attachment');
    }

    if (dto.replyToId) {
      await this.getMessageOrThrow(dto.replyToId);
    }

    const attachments: MessageAttachment[] = [];
    for (const [index, file] of files.entries()) {
      const type = resolveAttachmentType(file.mimetype);
      const options = this.buildUploadOptions(type);
      const result = await this.cloudinaryService.uploadFile(file, options);

      const attachment = new MessageAttachment();
      attachment.url = result.secure_url;
      attachment.thumbnailUrl = type === AttachmentType.IMAGE ? result.secure_url : null;
      attachment.type = type;
      attachment.filename = file.originalname;
      attachment.mimeType = file.mimetype;
      attachment.size = file.size;
      // Audio attachments (voice notes) carry a duration supplied by the client
      attachment.durationMillis = type === AttachmentType.AUDIO ? dto.durationMillis ?? null : null;
      attachment.order = index;
      attachments.push(attachment);
    }

    const message = this.messageRepository.create({
      groupId,
      userId,
      content: dto.content ?? null,
      replyToId: dto.replyToId,
      attachments,
    });
    const saved = await this.messageRepository.save(message);

    await this.groupRepository.update({ id: groupId }, { lastMessageAt: new Date() });

    const fullMessage = await this.getMessageOrThrow(saved.id);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MESSAGE_NEW, fullMessage);

    // Determine if this is a DM so the push payload carries `isDM: true`
    const isDM = group.type === GroupType.DIRECT;

    const members = await this.groupMemberRepository.find({ where: { groupId } });
    for (const member of members) {
      if (member.isMuted) continue;
      await this.notificationsService.notify(
        member.userId,
        userId,
        NotificationType.GROUP_MESSAGE,
        NotificationTargetType.GROUP,
        groupId,
        undefined,
        undefined,
        isDM ? { isDM: true, chatId: groupId } : undefined,
      );
    }

    return fullMessage;
  }

  async editMessage(userId: string, messageId: string, dto: EditMessageDto): Promise<GroupMessage> {
    const message = await this.getMessageOrThrow(messageId);
    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.isDeleted) {
      throw new ForbiddenException('This message has been deleted');
    }
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Edit window has expired');
    }

    message.content = dto.content;
    message.isEdited = true;
    message.editedAt = new Date();
    const saved = await this.messageRepository.save(message);
    this.groupsGateway.broadcastToGroup(message.groupId, GroupWebSocketEvents.MESSAGE_EDITED, saved);
    return saved;
  }

  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.getMessageOrThrow(messageId);
    const isAuthor = message.userId === userId;
    const isAdmin = await this.groupsService.isAdmin(message.groupId, userId);

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('Only the message author or a group admin can delete this message');
    }
    if (isAuthor && !isAdmin && Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Edit window has expired');
    }

    message.isDeleted = true;
    message.content = null;
    message.deletedAt = new Date();
    await this.messageRepository.save(message);

    // Strip references to the deleted message from any replies quoting it,
    // so reply bubbles don't keep pointing at a removed message.
    await this.messageRepository
      .createQueryBuilder()
      .update(GroupMessage)
      .set({ replyToId: null })
      .where('replyToId = :messageId', { messageId })
      .execute();

    this.groupsGateway.broadcastToGroup(message.groupId, GroupWebSocketEvents.MESSAGE_DELETED, { messageId });
  }

  async addReaction(userId: string, messageId: string, dto: AddReactionDto): Promise<MessageReaction> {
    const message = await this.getMessageOrThrow(messageId);
    const isMember = await this.groupsService.isMember(message.groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    let reaction = await this.reactionRepository.findOne({ where: { messageId, userId } });
    if (reaction) {
      reaction.emoji = dto.emoji;
    } else {
      reaction = this.reactionRepository.create({ messageId, userId, emoji: dto.emoji });
    }
    const saved = await this.reactionRepository.save(reaction);
    this.groupsGateway.broadcastToGroup(message.groupId, GroupWebSocketEvents.REACTION_ADDED, saved);
    return saved;
  }

  async removeReaction(userId: string, messageId: string): Promise<void> {
    const message = await this.getMessageOrThrow(messageId);
    const reaction = await this.reactionRepository.findOne({ where: { messageId, userId } });
    if (!reaction) return;

    await this.reactionRepository.remove(reaction);
    this.groupsGateway.broadcastToGroup(message.groupId, GroupWebSocketEvents.REACTION_REMOVED, {
      messageId,
      userId,
    });
  }

  async listMessages(
    userId: string,
    groupId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<GroupMessage>> {
    const isMember = await this.groupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const limit = pagination.limit ?? 20;

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .leftJoinAndSelect('message.replyTo', 'replyTo')
      .leftJoinAndSelect('replyTo.user', 'replyToUser')
      .leftJoinAndSelect('replyTo.attachments', 'replyToAttachments')
      .where('message.groupId = :groupId', { groupId })
      .andWhere('message.isDeleted = :isDeleted', { isDeleted: false });

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        '(message.createdAt < :createdAt OR (message.createdAt = :createdAt AND message.id < :id))',
        { createdAt, id },
      );
    }

    qb.orderBy('message.createdAt', 'DESC').addOrderBy('message.id', 'DESC').take(limit + 1);

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const last = items[items.length - 1];

    // Read receipts (1:1 conversations): compute whether the other participant
    // has read each message, based on their lastReadAt.
    let otherLastReadAt: Date | null = null;
    let readReceiptsEnabled = true;
    const otherMembership = await this.groupMemberRepository.findOne({
      where: { groupId, userId: Not(userId) },
      relations: { user: true },
    });
    if (otherMembership) {
      otherLastReadAt = otherMembership.lastReadAt ?? null;
      readReceiptsEnabled = otherMembership.user?.readReceipts ?? true;
    }

    if (items.length > 0 && otherMembership) {
      items.forEach((item) => {
        if (item.userId !== userId) return;
        const readByOther =
          readReceiptsEnabled &&
          Boolean(otherLastReadAt) &&
          new Date(item.createdAt).getTime() <= otherLastReadAt!.getTime();
        (item as any).readByOther = readByOther;
        (item as any).readReceiptsEnabled = readReceiptsEnabled;
      });
    }

    if (items.length > 0) {
      const messageIds = items.map((m) => m.id);
      const reactions = await this.reactionRepository.find({ where: { messageId: In(messageIds) } });

      const grouped = new Map<string, MessageReaction[]>();
      for (const reaction of reactions) {
        const list = grouped.get(reaction.messageId) ?? [];
        list.push(reaction);
        grouped.set(reaction.messageId, list);
      }

      items.forEach((item) => {
        const msgReactions = grouped.get(item.id) ?? [];
        const summary = new Map<string, number>();
        msgReactions.forEach((r) => summary.set(r.emoji, (summary.get(r.emoji) ?? 0) + 1));
        (item as any).reactionSummary = Array.from(summary.entries()).map(([emoji, count]) => ({
          emoji,
          count,
          reactedByMe: msgReactions.some((r) => r.emoji === emoji && r.userId === userId),
        }));
      });
    }

    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * Get the currently pinned message for a group (if any).
   */
  async getPinnedMessage(userId: string, groupId: string): Promise<GroupMessage | null> {
    const isMember = await this.groupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const pinned = await this.messageRepository.findOne({
      where: { groupId, isPinned: true, isDeleted: false },
      relations: { user: true, attachments: true, pinnedBy: true },
    });

    return pinned || null;
  }

/**
   * Pin a message so it appears at the top of the chat for all group members.
   * Any group member may pin messages. Only one message can be pinned at a
   * time — pinning a new message auto-unpins the previous one.
   */
  async pinMessage(userId: string, groupId: string, messageId: string): Promise<GroupMessage> {
    const isMember = await this.groupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const message = await this.getMessageOrThrow(messageId);
    if (message.groupId !== groupId) {
      throw new BadRequestException('Message does not belong to this group');
    }
    if (message.isDeleted) {
      throw new BadRequestException('Cannot pin a deleted message');
    }

    // Unpin any currently pinned message in this group (only one pinned at a time)
    await this.messageRepository
      .createQueryBuilder()
      .update(GroupMessage)
      .set({ isPinned: false, pinnedAt: null, pinnedById: null })
      .where('groupId = :groupId AND isPinned = true', { groupId })
      .execute();

    // Pin the new message, recording who performed the action
    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedById = userId;
    const saved = await this.messageRepository.save(message);

    // Look up the acting user's public info for the broadcast payload —
    // `saved` doesn't carry the `pinnedBy` relation since we only set the
    // `pinnedById` column, not the relation object.
    const actingMember = await this.groupMemberRepository.findOne({
      where: { groupId, userId },
      relations: { user: true },
    });

    // Broadcast to all members in real-time
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MESSAGE_PINNED, {
      groupId,
      messageId: saved.id,
      pinnedMessage: saved,
      pinnedBy: actingMember?.user
        ? { id: actingMember.user.id, username: actingMember.user.username }
        : { id: userId },
    });

    return saved;
  }

  /**
   * Unpin the currently pinned message in a group.
   */
  async unpinMessage(userId: string, groupId: string, messageId: string): Promise<void> {
    const isMember = await this.groupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const message = await this.getMessageOrThrow(messageId);
    if (message.groupId !== groupId) {
      throw new BadRequestException('Message does not belong to this group');
    }

    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedById = null;
    await this.messageRepository.save(message);

    // Broadcast unpin to all members in real-time
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MESSAGE_UNPINNED, {
      groupId,
      messageId: message.id,
    });
  }
}
