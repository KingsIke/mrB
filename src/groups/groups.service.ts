import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Group, GroupType } from './entities/group.entity';
import { GroupMember, GroupMemberRole } from './entities/group-member.entity';
import { GroupMessage } from './entities/group-message.entity';
import { AttachmentType } from './entities/message-attachment.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { LockGroupDto } from './dto/lock-group.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SchoolsService } from '../schools/schools.service';
import { FacultiesService } from '../faculties/faculties.service';
import { DepartmentsService } from '../departments/departments.service';
import { FollowsService } from '../follows/follows.service';
import { GroupsGateway, GroupWebSocketEvents } from './groups.gateway';
import { GamificationService } from 'src/gamification/gamification.service';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePictureUrl: string | null;
  profileFrame: string | null;
}

interface DefaultGroupPreset {
  slug: string;
  name: string;
  description: string;
  iconUrl?: string;
}

const DEFAULT_GROUPS_PRESETS: DefaultGroupPreset[] = [
  {
    slug: 'technology',
    name: 'Technology',
    description: 'Discuss gadgets, software engineering, AI, and emerging tech trends.',
    iconUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'sports',
    name: 'Sports',
    description: 'Football, basketball, athletics, fantasy leagues, and match banter.',
    iconUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'movies',
    name: 'Movies & TV Series',
    description: 'Film reviews, recommendations, cinema chatter, and series recaps.',
    iconUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'music',
    name: 'Music & Vibes',
    description: 'Share playlists, new song releases, genres, and concert experiences.',
    iconUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'love-relationships',
    name: 'Love & Relationships',
    description: 'Dating advice, relationship stories, confessions, and heart-to-heart chats.',
    iconUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    description: 'eSports, console/PC gaming, mobile games, and multiplayer setups.',
    iconUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'fashion-lifestyle',
    name: 'Fashion & Lifestyle',
    description: 'Style tips, outfits, grooming, and everyday lifestyle trends.',
    iconUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=512&h=512&q=80',
  },
  {
    slug: 'academics-career',
    name: 'Career & Academics',
    description: 'Study hacks, internship opportunities, resume advice, and career growth.',
    iconUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=512&h=512&q=80',
  },
];

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,

    @InjectRepository(GroupMessage) 
    private readonly groupMessageRepository: Repository<GroupMessage>,

    private readonly cloudinaryService: CloudinaryService,
    private readonly schoolsService: SchoolsService,
    private readonly facultiesService: FacultiesService,
    private readonly departmentsService: DepartmentsService,
    private readonly followsService: FollowsService,
    private readonly groupsGateway: GroupsGateway,
    private readonly gamificationService: GamificationService,
  ) {}



  /**
   * Seeds default interest groups into the database idempotently.
   */
  async seedDefaultGroups(): Promise<void> {
    this.logger.log('Seeding default interest groups...');

    for (const preset of DEFAULT_GROUPS_PRESETS) {
      const existing = await this.groupRepository.findOne({
        where: { type: GroupType.DEFAULT, sourceId: preset.slug },
      });

      if (!existing) {
        try {
          const group = this.groupRepository.create({
            type: GroupType.DEFAULT,
            sourceId: preset.slug,
            name: preset.name,
            description: preset.description,
            iconUrl: preset.iconUrl ?? null,
            isSystemManaged: true,
          });

          await this.groupRepository.save(group);
          this.logger.log(`Created default group: "${preset.name}"`);
        } catch (error: any) {
          if (error.code === '23505') {
            this.logger.debug(
              `Default group "${preset.name}" already initialized by another instance.`,
            );
          } else {
            this.logger.error(
              `Failed to seed default group "${preset.name}": ${error.message}`,
              error.stack,
            );
          }
        }
      }
    }
  }

  // --- Core Utility Methods ---

  async getGroupOrThrow(groupId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found`);
    }
    return group;
  }

  private async getMembershipOrThrow(groupId: string, userId: string): Promise<GroupMember> {
  let membership = await this.groupMemberRepository.findOne({ where: { groupId, userId } });

  if (!membership) {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    
    // Auto-join if it's a default interest group
    if (group && group.type === GroupType.DEFAULT) {
      // Race-safe insert: parallel requests (detail, members, messages) may
      // all try to auto-join at once, so ignore unique-constraint conflicts.
      const result = (await this.groupMemberRepository
        .createQueryBuilder()
        .insert()
        .into(GroupMember)
        .values({
          groupId: group.id,
          userId,
          role: GroupMemberRole.MEMBER,
        })
        .orIgnore()
        .execute()) as { affected?: number };

      if ((result.affected ?? 0) > 0) {
        await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);
      }

      membership = await this.groupMemberRepository.findOne({
        where: { groupId: group.id, userId },
      });
      return membership!;
    }

    throw new ForbiddenException('You are not a member of this group');
  }

  return membership;
}

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.groupMemberRepository.findOne({ where: { groupId, userId } });
    return !!membership;
  }

  async isAdmin(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.groupMemberRepository.findOne({ where: { groupId, userId } });
    return membership?.role === GroupMemberRole.ADMIN;
  }

  // --- System & Default Groups (auto-join on onboarding) ---

  async getOrCreateSystemGroup(
    type: GroupType,
    sourceId: string,
    name: string,
  ): Promise<Group> {
    const existing = await this.groupRepository.findOne({ where: { type, sourceId } });
    if (existing) return existing;

    try {
      const group = this.groupRepository.create({
        type,
        sourceId,
        name,
        isSystemManaged: true,
      });
      return await this.groupRepository.save(group);
    } catch (error: any) {
      if (error.code === '23505') {
        const raceWinner = await this.groupRepository.findOne({ where: { type, sourceId } });
        if (raceWinner) return raceWinner;
      }
      throw error;
    }
  }

  async autoJoinDefaultGroups(userId: string): Promise<void> {
    const defaultGroups = await this.groupRepository.find({
      where: { type: GroupType.DEFAULT },
    });

    for (const group of defaultGroups) {
      const alreadyMember = await this.isMember(group.id, userId);
      if (!alreadyMember) {
        await this.groupMemberRepository.save(
          this.groupMemberRepository.create({
            groupId: group.id,
            userId,
            role: GroupMemberRole.MEMBER,
          }),
        );
        await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);
      }
    }
  }

  async autoJoinSystemGroups(
    userId: string,
    schoolId: string,
    facultyId: string,
    departmentId: string,
  ): Promise<void> {
    // 1. Auto-join global default interest groups
    await this.autoJoinDefaultGroups(userId);

    // 2. Fetch institution-specific entities
    const [school, faculty, department] = await Promise.all([
      this.schoolsService.findById(schoolId),
      this.facultiesService.findById(facultyId),
      this.departmentsService.findById(departmentId),
    ]);

    const targets: { type: GroupType; sourceId: string; name: string }[] = [];
    if (school) targets.push({ type: GroupType.SCHOOL, sourceId: schoolId, name: `${school.name} - School Group` });
    if (faculty) targets.push({ type: GroupType.FACULTY, sourceId: facultyId, name: `${faculty.name} - Faculty Group` });
    if (department) {
      targets.push({
        type: GroupType.DEPARTMENT,
        sourceId: departmentId,
        name: `${department.name} - Department Group`,
      });
    }

    for (const target of targets) {
      const group = await this.getOrCreateSystemGroup(target.type, target.sourceId, target.name);
      const alreadyMember = await this.isMember(group.id, userId);
      if (!alreadyMember) {
        await this.groupMemberRepository.save(
          this.groupMemberRepository.create({ groupId: group.id, userId, role: GroupMemberRole.MEMBER }),
        );
        await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);
      }
    }
  }

  // --- Manual Join Method ---

async joinGroup(userId: string, groupId: string): Promise<GroupMember> {
  const group = await this.getGroupOrThrow(groupId);

  // Prevent manual joining if it's a 1:1 Direct Message
  if (group.type === GroupType.DIRECT) {
    throw new ForbiddenException('Cannot manually join a direct conversation');
  }

  // Check if already a member
  const existingMembership = await this.groupMemberRepository.findOne({
    where: { groupId: group.id, userId },
  });

  if (existingMembership) {
    return existingMembership;
  }

  // Handle joining default/system interest groups or public groups
  const member = await this.groupMemberRepository.save(
    this.groupMemberRepository.create({
      groupId: group.id,
      userId,
      role: GroupMemberRole.MEMBER,
    }),
  );

  await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);

  this.groupsGateway.broadcastToGroup(
    groupId,
    GroupWebSocketEvents.MEMBER_ADDED,
    member,
  );

  return member;
}

  
async getDefaultGroups(): Promise<Group[]> {
  return this.groupRepository.find({
    where: { type: GroupType.DEFAULT },
    order: { name: 'ASC' },
  });
}

  // --- Custom Groups ---

  async createGroup(userId: string, dto: CreateGroupDto, icon?: Express.Multer.File): Promise<Group> {
    let iconUrl: string | null = null;
    if (icon) {
      const result = await this.cloudinaryService.uploadFile(icon, {
        folder: 'groups/icons',
        resourceType: 'image',
        transformation: [{ crop: 'fill', width: 512, height: 512 }],
      });
      iconUrl = result.secure_url;
    }

    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description,
      iconUrl,
      type: GroupType.CUSTOM,
      createdById: userId,
    });
    const saved = await this.groupRepository.save(group);

    await this.groupMemberRepository.save(
      this.groupMemberRepository.create({ groupId: saved.id, userId, role: GroupMemberRole.ADMIN }),
    );
    await this.groupRepository.increment({ id: saved.id }, 'membersCount', 1);

    return this.getGroupOrThrow(saved.id);
  }

  async updateGroupSettings(
    userId: string,
    groupId: string,
    dto: UpdateGroupDto,
    icon?: Express.Multer.File,
  ): Promise<Group> {
    const group = await this.getGroupOrThrow(groupId);
    await this.getMembershipOrThrow(groupId, userId);

    if (group.type !== GroupType.CUSTOM) {
      throw new ForbiddenException('Only custom groups can be renamed or re-branded');
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;

    if (icon) {
      const result = await this.cloudinaryService.uploadFile(icon, {
        folder: 'groups/icons',
        resourceType: 'image',
        transformation: [{ crop: 'fill', width: 512, height: 512 }],
      });
      group.iconUrl = result.secure_url;
    }

    const saved = await this.groupRepository.save(group);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.GROUP_UPDATED, saved);
    return saved;
  }

  async lockMessages(userId: string, groupId: string, dto: LockGroupDto): Promise<Group> {
    const group = await this.getGroupOrThrow(groupId);
    if (group.type !== GroupType.CUSTOM) {
      throw new ForbiddenException('Only custom groups can be locked');
    }
    const isAdmin = await this.isAdmin(groupId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only a group admin can lock or unlock this group');
    }

    group.isLocked = dto.isLocked;
    const saved = await this.groupRepository.save(group);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.GROUP_UPDATED, saved);
    return saved;
  }

  async setMute(userId: string, groupId: string, isMuted: boolean): Promise<GroupMember> {
    const membership = await this.getMembershipOrThrow(groupId, userId);
    membership.isMuted = isMuted;
    return this.groupMemberRepository.save(membership);
  }

  // --- Membership Management ---

  async addMember(actingUserId: string, groupId: string, targetUserId: string): Promise<GroupMember> {
    const group = await this.getGroupOrThrow(groupId);
    if (group.type !== GroupType.CUSTOM) {
      throw new ForbiddenException('Members can only be added to custom groups');
    }
    const isAdmin = await this.isAdmin(groupId, actingUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only a group admin can add members');
    }

    const existing = await this.groupMemberRepository.findOne({
      where: { groupId, userId: targetUserId },
    });
    if (existing) return existing;

    const member = await this.groupMemberRepository.save(
      this.groupMemberRepository.create({ groupId, userId: targetUserId, role: GroupMemberRole.MEMBER }),
    );
    await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MEMBER_ADDED, member);
    return member;
  }

  async removeMember(actingUserId: string, groupId: string, targetUserId: string): Promise<void> {
    const group = await this.getGroupOrThrow(groupId);
    if (group.type !== GroupType.CUSTOM) {
      throw new ForbiddenException('Members can only be removed from custom groups');
    }
    const isAdmin = await this.isAdmin(groupId, actingUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only a group admin can remove members');
    }

    const target = await this.groupMemberRepository.findOne({ where: { groupId, userId: targetUserId } });
    if (!target) return;

    if (target.role === GroupMemberRole.ADMIN) {
      const adminCount = await this.groupMemberRepository.count({
        where: { groupId, role: GroupMemberRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last remaining admin');
      }
    }

    await this.groupMemberRepository.remove(target);
    await this.groupRepository.decrement({ id: groupId }, 'membersCount', 1);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MEMBER_REMOVED, { userId: targetUserId });
  }

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.getGroupOrThrow(groupId);
    if (group.type !== GroupType.CUSTOM) {
      throw new ForbiddenException('You cannot leave this group');
    }

    const membership = await this.getMembershipOrThrow(groupId, userId);
    if (membership.role === GroupMemberRole.ADMIN) {
      const adminCount = await this.groupMemberRepository.count({
        where: { groupId, role: GroupMemberRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Assign another admin before leaving this group');
      }
    }

    await this.groupMemberRepository.remove(membership);
    await this.groupRepository.decrement({ id: groupId }, 'membersCount', 1);
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MEMBER_REMOVED, { userId });
  }

  // --- Listings & Details ---

  async listUserGroups(userId: string): Promise<any[]> {
    const memberships = await this.groupMemberRepository.find({
      where: { userId, group: { type: Not(GroupType.DIRECT) } },
      relations: { group: true },
    });

    if (memberships.length === 0) return [];

    const groupsWithUnread = await Promise.all(
      memberships.map(async (m) => {
        const group = m.group;

        const unreadQb = this.groupMessageRepository
          .createQueryBuilder('message')
          .where('message.groupId = :groupId', { groupId: group.id })
          .andWhere('message.userId != :userId', { userId }); 

        if (m.lastReadAt) {
          unreadQb.andWhere('message.createdAt > :lastReadAt', {
            lastReadAt: m.lastReadAt,
          });
        }

        const unreadCount = await unreadQb.getCount();

        return {
          ...group,
          unreadCount,
          lastReadAt: m.lastReadAt,
        };
      }),
    );

    return groupsWithUnread.sort(
      (a, b) =>
        (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0) -
        (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0),
    );
  }

  async markAsRead(userId: string, groupId: string): Promise<void> {
    const membership = await this.getMembershipOrThrow(groupId, userId);
    membership.lastReadAt = new Date();
    await this.groupMemberRepository.save(membership);

    // Respect the reader's own read-receipts privacy setting before letting
    // other members see that their messages were read.
    const reader = await this.groupMemberRepository.findOne({
      where: { groupId, userId },
      relations: { user: true },
    });
    if (reader?.user?.readReceipts === false) {
      return;
    }

    // Broadcast to the whole room (not just one arbitrary "other" member) so
    // this reflects correctly for groups with more than two members, not
    // just 1:1 DMs. Recipients ignore their own read events client-side.
    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.MESSAGE_READ, {
      groupId,
      userId,
      lastReadAt: membership.lastReadAt,
    });
  }

  async getGroupDetail(userId: string, groupId: string): Promise<Group> {
    const group = await this.getGroupOrThrow(groupId);
    await this.getMembershipOrThrow(groupId, userId);
    return group;
  }

  async listMembers(userId: string, groupId: string): Promise<any[]> {
    await this.getMembershipOrThrow(groupId, userId);

    const members = await this.groupMemberRepository.find({
      where: { groupId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return Promise.all(
      members.map(async (member) => {
        const xpData = await this.gamificationService.getMe(member.userId);

        return {
          ...member,
          user: {
            ...member.user,
            appLevel: xpData.level,
          },
        };
      }),
    );
  }

  // --- Role Management ---

  async promoteMember(actingUserId: string, groupId: string, targetUserId: string): Promise<GroupMember> {
    await this.getGroupOrThrow(groupId);

    const isAdmin = await this.isAdmin(groupId, actingUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only a group admin can promote members');
    }

    const targetMembership = await this.getMembershipOrThrow(groupId, targetUserId);

    if (targetMembership.role === GroupMemberRole.ADMIN) {
      return targetMembership;
    }

    targetMembership.role = GroupMemberRole.ADMIN;
    const updatedMember = await this.groupMemberRepository.save(targetMembership);

    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.GROUP_UPDATED, {
      userId: targetUserId,
      role: GroupMemberRole.ADMIN,
    });

    return updatedMember;
  }

  async demoteMember(actingUserId: string, groupId: string, targetUserId: string): Promise<GroupMember> {
    await this.getGroupOrThrow(groupId);

    const isAdmin = await this.isAdmin(groupId, actingUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only a group admin can demote members');
    }

    if (actingUserId === targetUserId) {
      throw new ForbiddenException('You cannot demote yourself');
    }

    const targetMembership = await this.getMembershipOrThrow(groupId, targetUserId);

    if (targetMembership.role === GroupMemberRole.MEMBER) {
      return targetMembership;
    }

    const adminCount = await this.groupMemberRepository.count({
      where: { groupId, role: GroupMemberRole.ADMIN },
    });

    if (adminCount <= 1) {
      throw new ForbiddenException('Cannot demote the last remaining admin');
    }

    targetMembership.role = GroupMemberRole.MEMBER;
    const updatedMember = await this.groupMemberRepository.save(targetMembership);

    this.groupsGateway.broadcastToGroup(groupId, GroupWebSocketEvents.GROUP_UPDATED, {
      userId: targetUserId,
      role: GroupMemberRole.MEMBER,
    });

    return updatedMember;
  }

  // --- Direct Messages (1:1 conversations) ---

  async getOrCreateDirectConversation(userId: string, otherUserId: string): Promise<Group> {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot start a conversation with yourself');
    }

    const isBlocked = await this.followsService.isBlocked(userId, otherUserId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot message this user');
    }

    const pairKey = [userId, otherUserId].sort().join(':');

    return await this.groupRepository.manager.transaction(async (transactionalEntityManager) => {
      let group = await transactionalEntityManager.findOne(this.groupRepository.target, {
        where: { type: GroupType.DIRECT, sourceId: pairKey },
      });

      if (!group) {
        try {
          const newGroup = transactionalEntityManager.create(this.groupRepository.target, {
            type: GroupType.DIRECT,
            sourceId: pairKey,
            name: null,
            membersCount: 2,
          });
          group = await transactionalEntityManager.save(newGroup);
        } catch (error: any) {
          if (error.code === '23505') {
            group = await transactionalEntityManager.findOne(this.groupRepository.target, {
              where: { type: GroupType.DIRECT, sourceId: pairKey },
            });
          }
          if (!group) throw error;
        }
      }

      for (const participantId of [userId, otherUserId]) {
        const existingMembership = await transactionalEntityManager.findOne(this.groupMemberRepository.target, {
          where: { groupId: group.id, userId: participantId },
        });

        if (!existingMembership) {
          const member = transactionalEntityManager.create(this.groupMemberRepository.target, {
            groupId: group.id,
            userId: participantId,
            role: GroupMemberRole.MEMBER,
            isHidden: false,
          });
          await transactionalEntityManager.save(member);
        } else if (participantId === userId && existingMembership.isHidden) {
          existingMembership.isHidden = false;
          await transactionalEntityManager.save(existingMembership);
        }
      }

      return group;
    });
  }

  async listDirectConversations(userId: string): Promise<
    Array<
      Group & {
        participant: UserSummary | null;
        unreadCount: number;
        lastReadAt: Date | null;
        lastMessageContent: string | null;
        lastMessagePreview: {
          content: string | null;
          isAudio: boolean;
          mimeType: string | null;
          durationMillis: number | null;
          readByOther: boolean;
          readReceiptsEnabled: boolean;
        };
      }
    >
  > {
    const memberships = await this.groupMemberRepository.find({
      where: { userId, isHidden: false },
      relations: { group: true },
    });

    const directMemberships = memberships.filter(
      (m) => m.group?.type === GroupType.DIRECT && Boolean(m.group?.lastMessageAt)
    );

    const groupIds = directMemberships.map((m) => m.group.id);
    const otherMembers = groupIds.length
      ? await this.groupMemberRepository.find({
          where: { groupId: In(groupIds) },
          relations: { user: true },
        })
      : [];

    const conversationsWithDetails = await Promise.all(
      directMemberships.map(async (m) => {
        const group = m.group;
        const other = otherMembers.find(
          (om) => om.groupId === group.id && om.userId !== userId
        );

        const participant: UserSummary | null = other?.user
          ? {
              id: other.user.id,
              firstName: other.user.firstName,
              lastName: other.user.lastName,
              username: other.user.username,
              profilePictureUrl: other.user.profilePictureUrl,
              profileFrame: other.user.profileFrame || null,
            }
          : null;

        const latestMessage = await this.groupMessageRepository.findOne({
          where: { groupId: group.id, isDeleted: false },
          order: { createdAt: 'DESC' },
          relations: { attachments: true },
        });

        const unreadQb = this.groupMessageRepository
          .createQueryBuilder('message')
          .where('message.groupId = :groupId', { groupId: group.id })
          .andWhere('message.userId != :userId', { userId });

        if (m.lastReadAt) {
          unreadQb.andWhere('message.createdAt > :lastReadAt', {
            lastReadAt: m.lastReadAt,
          });
        }

        const unreadCount = await unreadQb.getCount();

        // Last-message summary: text content, or voice-note info for audio attachments
        const lastAudio = latestMessage?.attachments?.find(
          (a) => a.type === AttachmentType.AUDIO,
        );
        // Read state for the list tick: did the other participant read my last message?
        let readByOther = false;
        let readReceiptsEnabled = true;
        if (latestMessage && latestMessage.userId === userId && other) {
          readReceiptsEnabled = other.user?.readReceipts ?? true;
          if (readReceiptsEnabled && other.lastReadAt) {
            readByOther =
              new Date(latestMessage.createdAt).getTime() <= other.lastReadAt.getTime();
          }
        }

        const lastMessagePreview = {
          content: latestMessage?.content ?? null,
          isAudio: Boolean(lastAudio),
          mimeType: lastAudio?.mimeType ?? null,
          durationMillis: lastAudio?.durationMillis ?? null,
          readByOther,
          readReceiptsEnabled,
        };

        return Object.assign(group, {
          participant,
          unreadCount,
          lastReadAt: m.lastReadAt,
          lastMessageContent: latestMessage?.content ?? null,
          lastMessagePreview,
        });
      })
    );

    return conversationsWithDetails.sort(
      (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
    );
  }

  async hideConversation(userId: string, groupId: string): Promise<void> {
    const group = await this.getGroupOrThrow(groupId);
    if (group.type !== GroupType.DIRECT) {
      throw new ForbiddenException('Only direct-message conversations can be hidden');
    }
    const membership = await this.getMembershipOrThrow(groupId, userId);
    membership.isHidden = true;
    await this.groupMemberRepository.save(membership);
  }
}