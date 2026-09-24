import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

/**
 * Deletes a user's personal data when they delete their account.
 *
 * The users row itself is kept but scrubbed of everything personal, because
 * financial records (coin purchases, gifts, withdrawals) reference it and
 * must be retained. Everything else the user created or that describes them
 * is deleted.
 */

// Tables whose rows belong to the deleted user and are removed outright.
// Rows are matched on every column that references the user (e.g. both
// followerId and followingId), read from TypeORM's metadata so new
// relations are picked up without editing column names here.
// Where only some of those columns mean "owned by the user", list them in
// OWNER_COLUMNS instead.
const USER_OWNED_ENTITIES = [
  // Social content (their likes, views, replies, attachments cascade)
  'Post',
  'PostComment',
  'PostLike',
  'PostFavorite',
  'PostView',
  'PostReshare',
  'PostTag',
  'CommentLike',
  'Story',
  'StoryReply',
  'StoryReaction',
  'StoryView',
  'GroupMessage',
  'MessageReaction',
  'GroupMember',
  // Relationships and activity
  'Follow',
  'UserBlock',
  'UserSearchHistory',
  'Notification',
  'CallHistory',
  // Listings (their likes and applications cascade)
  'MarketplaceItem',
  'MarketplaceLike',
  'HostelListing',
  'HostelLike',
  'Job',
  'JobApplication',
  // Account security and payout details
  'OtpCode',
  'SavedWithdrawalAccount',
];

// GroupMessage also references the user as pinnedById. Messages other people
// wrote must survive; they're just unpinned (see unpinMessages).
const OWNER_COLUMNS: Record<string, string[]> = {
  GroupMessage: ['userId'],
};

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /** Removes the user's personal data in one transaction, then their uploaded files. */
  async deleteUserData(user: User): Promise<void> {
    const files = [
      user.profilePictureUrl,
      user.schoolIdCardUrl,
      user.administrationLetterUrl,
      user.studentUnionDocUrl,
    ].filter((url): url is string => Boolean(url));

    await this.dataSource.transaction(async (manager) => {
      await this.unpinMessages(manager, user.id);
      for (const entityName of USER_OWNED_ENTITIES) {
        await this.deleteRowsFor(manager, entityName, user.id);
      }
      await this.scrubUserRow(manager, user.id);
    });

    // Best effort, after the commit: a missing file shouldn't undo the deletion.
    for (const url of files) {
      await this.destroyCloudinaryFile(url);
    }
  }

  private async deleteRowsFor(manager: EntityManager, entityName: string, userId: string) {
    const metadata = this.dataSource.entityMetadatas.find((m) => m.name === entityName);
    if (!metadata) {
      throw new Error(`Account deletion: entity ${entityName} is not registered`);
    }

    const columns = OWNER_COLUMNS[entityName] ?? metadata.manyToOneRelations
      .filter((relation) => relation.inverseEntityMetadata.target === User)
      .flatMap((relation) => relation.joinColumns.map((column) => column.databaseName));
    if (!columns.length && metadata.findColumnWithDatabaseName('userId')) {
      columns.push('userId');
    }
    if (!columns.length) {
      throw new Error(`Account deletion: ${entityName} has no column referencing the user`);
    }

    await manager
      .createQueryBuilder()
      .delete()
      .from(metadata.target)
      .where(columns.map((column) => `"${column}" = :userId`).join(' OR '), { userId })
      .execute();
  }

  private async unpinMessages(manager: EntityManager, userId: string) {
    await manager
      .createQueryBuilder()
      .update('group_messages')
      .set({ isPinned: false, pinnedAt: null, pinnedById: null })
      .where('"pinnedById" = :userId', { userId })
      .execute();
  }

  private async scrubUserRow(manager: EntityManager, userId: string) {
    const suffix = `${Date.now()}-${userId.slice(0, 8)}`;
    await manager.update(User, userId, {
      // Identity: unusable and unidentifiable
      email: `deleted-${suffix}@deleted.local`,
      username: `deleted_${suffix}`,
      phoneNumber: `deleted-${suffix}`,
      firstName: 'Deleted',
      lastName: 'User',
      bio: '',
      profilePictureUrl: null as unknown as string,
      password: null,
      googleId: null,
      pushToken: null,
      notificationPreferences: null,
      twoFactorEnabled: false,
      // Personal and academic details
      gender: null as unknown as User['gender'],
      dateOfBirth: null as unknown as Date,
      programType: null as unknown as string,
      matricNumber: null as unknown as string,
      jambNumber: null as unknown as string,
      schoolId: null as unknown as string,
      facultyId: null as unknown as string,
      departmentId: null as unknown as string,
      // Verification documents and review notes
      schoolIdCardUrl: null as unknown as string,
      administrationLetterUrl: null as unknown as string,
      studentUnionDocUrl: null as unknown as string,
      studentUnion: false,
      rejectionReason: null,
      statusReason: null,
      // Account state
      deletedAt: new Date(),
      deactivatedAt: null,
      passwordChangedAt: new Date(),
    });
  }

  /**
   * Cloudinary URLs look like
   * https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/[transforms/]v123/<folder>/<name>.<ext>
   * The public id is the path after the version segment, without the extension.
   */
  private async destroyCloudinaryFile(url: string) {
    const match = url.match(/\/(image|video|raw)\/upload\/(?:.*?\/)?v\d+\/(.+)$/);
    if (!match) return;
    const [, resourceType, path] = match;
    const publicId = resourceType === 'raw' ? path : path.replace(/\.[^/.]+$/, '');
    try {
      await this.cloudinaryService.destroyFile(publicId, resourceType as 'image' | 'video' | 'raw');
    } catch (err) {
      this.logger.warn(`Account deletion: could not delete file ${publicId}: ${err}`);
    }
  }
}
