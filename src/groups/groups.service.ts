import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group, GroupType } from './entities/group.entity';
import { GroupMember, GroupMemberRole } from './entities/group-member.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { LockGroupDto } from './dto/lock-group.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SchoolsService } from '../schools/schools.service';
import { FacultiesService } from '../faculties/faculties.service';
import { DepartmentsService } from '../departments/departments.service';
import { FollowsService } from '../follows/follows.service';
import { GroupsGateway, GroupWebSocketEvents } from './groups.gateway';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePictureUrl: string | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly schoolsService: SchoolsService,
    private readonly facultiesService: FacultiesService,
    private readonly departmentsService: DepartmentsService,
    private readonly followsService: FollowsService,
    private readonly groupsGateway: GroupsGateway,
  ) {}

  async getGroupOrThrow(groupId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with ID "${groupId}" not found`);
    }
    return group;
  }

  private async getMembershipOrThrow(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.groupMemberRepository.findOne({ where: { groupId, userId } });
    if (!membership) {
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

  // --- System groups (auto-join on onboarding) ---

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

  async autoJoinSystemGroups(
    userId: string,
    schoolId: string,
    facultyId: string,
    departmentId: string,
  ): Promise<void> {
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

  // --- Custom groups ---

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

  // --- Membership management ---

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

  // --- Listings ---

  async listUserGroups(userId: string): Promise<Group[]> {
    const memberships = await this.groupMemberRepository.find({
      where: { userId },
      relations: { group: true },
    });
    return memberships
      .map((m) => m.group)
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  }

  async getGroupDetail(userId: string, groupId: string): Promise<Group> {
    const group = await this.getGroupOrThrow(groupId);
    await this.getMembershipOrThrow(groupId, userId);
    return group;
  }

  async listMembers(userId: string, groupId: string): Promise<GroupMember[]> {
    await this.getMembershipOrThrow(groupId, userId);
    return this.groupMemberRepository.find({
      where: { groupId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
  }

  // --- Direct messages (1:1 conversations) ---

  async getOrCreateDirectConversation(userId: string, otherUserId: string): Promise<Group> {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot start a conversation with yourself');
    }

    const isBlocked = await this.followsService.isBlocked(userId, otherUserId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot message this user');
    }

    const pairKey = [userId, otherUserId].sort().join(':');

    let group = await this.groupRepository.findOne({ where: { type: GroupType.DIRECT, sourceId: pairKey } });
    if (!group) {
      try {
        group = await this.groupRepository.save(
          this.groupRepository.create({ type: GroupType.DIRECT, sourceId: pairKey, name: null }),
        );
      } catch (error: any) {
        if (error.code === '23505') {
          group = await this.groupRepository.findOne({ where: { type: GroupType.DIRECT, sourceId: pairKey } });
        }
        if (!group) throw error;
      }
    }

    for (const participantId of [userId, otherUserId]) {
      const existingMembership = await this.groupMemberRepository.findOne({
        where: { groupId: group.id, userId: participantId },
      });
      if (!existingMembership) {
        await this.groupMemberRepository.save(
          this.groupMemberRepository.create({ groupId: group.id, userId: participantId, role: GroupMemberRole.MEMBER }),
        );
        await this.groupRepository.increment({ id: group.id }, 'membersCount', 1);
      } else if (participantId === userId && existingMembership.isHidden) {
        existingMembership.isHidden = false;
        await this.groupMemberRepository.save(existingMembership);
      }
    }

    return group;
  }

  async listDirectConversations(userId: string): Promise<Array<Group & { participant: UserSummary | null }>> {
    const memberships = await this.groupMemberRepository.find({
      where: { userId, isHidden: false },
      relations: { group: true },
    });
    const directMemberships = memberships.filter((m) => m.group.type === GroupType.DIRECT);

    const groupIds = directMemberships.map((m) => m.group.id);
    const otherMembers = groupIds.length
      ? await this.groupMemberRepository.find({
          where: { groupId: In(groupIds) },
          relations: { user: true },
        })
      : [];

    return directMemberships
      .map((m) => {
        const other = otherMembers.find((om) => om.groupId === m.group.id && om.userId !== userId);
        const participant: UserSummary | null = other?.user
          ? {
              id: other.user.id,
              firstName: other.user.firstName,
              lastName: other.user.lastName,
              username: other.user.username,
              profilePictureUrl: other.user.profilePictureUrl,
            }
          : null;
        return Object.assign(m.group, { participant });
      })
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
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
