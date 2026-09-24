import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * Server-side record of issued refresh tokens, so they can be revoked
 * (logout, password change, account deactivation) and rotated on use.
 *
 * Tokens are hashed with SHA-256 rather than bcrypt: bcrypt only reads the
 * first 72 bytes, and JWTs for the same user share a long common prefix.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async store(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Housekeeping: drop this user's expired rows while we're here.
    await this.refreshTokenRepository.delete({ userId, expiresAt: LessThan(new Date()) });
    await this.refreshTokenRepository.insert({
      userId,
      tokenHash: this.hash(token),
      expiresAt,
    });
  }

  /**
   * Consumes a refresh token so it can't be used again. If a token with a
   * valid signature isn't on record it was already used or revoked, which
   * can mean it was stolen — every session for that user is revoked.
   */
  async consume(userId: string, token: string): Promise<void> {
    const result = await this.refreshTokenRepository.delete({
      userId,
      tokenHash: this.hash(token),
    });

    if (!result.affected) {
      await this.revokeAllForUser(userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }
  }

  async revoke(token: string): Promise<void> {
    await this.refreshTokenRepository.delete({ tokenHash: this.hash(token) });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.delete({ userId });
  }
}
