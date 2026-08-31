/**
 * stream.service.ts
 *
 * Handles Stream Video SDK integration:
 * - Generates short-lived tokens for client-side Stream connections
 * - Registers device push tokens for incoming call notifications
 * - Creates/updates Stream users when they connect
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { StreamClient } from '@stream-io/node-sdk';

@Injectable()
export class StreamService implements OnModuleInit {
  private readonly logger = new Logger(StreamService.name);
  private streamClient: StreamClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('STREAM_API_KEY');
    const apiSecret = this.configService.get<string>('STREAM_API_SECRET');

    if (!apiKey || !apiSecret) {
      this.logger.warn(
        '[Stream] STREAM_API_KEY or STREAM_API_SECRET not configured — video calls disabled',
      );
      return;
    }

    this.streamClient = new StreamClient(apiKey, apiSecret);
    this.logger.log('[Stream] Stream client initialized');
  }

  /**
   * Generate a short-lived token for a user to connect to Stream Video.
   * Called by the client when they want to make/receive calls.
   */
  async generateToken(userId: string): Promise<{ token: string; apiKey: string } | null> {
    if (!this.streamClient) {
      this.logger.warn('[Stream] Client not initialized — cannot generate token');
      return null;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`[Stream] User ${userId} not found — cannot generate token`);
      return null;
    }

    const apiKey = this.configService.get<string>('STREAM_API_KEY');

    try {
      // Create/update the user in Stream's system
      await this.streamClient.upsertUsers([{
        id: userId,
        name: user.fullName || user.username || 'User',
        image: user.profilePictureUrl || undefined,
      }]);

      // Generate a token valid for 24 hours
      const token = this.streamClient.generateUserToken({
        user_id: userId,
        validity_in_seconds: 60 * 60 * 24, // 24 hours
      });

      this.logger.log(`[Stream] Generated token for user ${userId}`);
      return { token, apiKey: apiKey || '' };
    } catch (err) {
      this.logger.error(`[Stream] Failed to generate token for ${userId}:`, err);
      return null;
    }
  }

  /**
   * Register a device for push notifications.
   * The client sends its Expo push token after connecting to Stream.
   */
  async registerDevice(
    userId: string,
    pushToken: string,
    provider: 'apn' | 'firebase' = 'firebase',
  ): Promise<{ success: boolean }> {
    if (!this.streamClient) {
      this.logger.warn('[Stream] Client not initialized — cannot register device');
      return { success: false };
    }

    try {
      await this.streamClient.createDevice({
        id: pushToken,
        push_provider: provider,
        user_id: userId,
      });
      this.logger.log(`[Stream] Registered device for user ${userId} (${provider})`);
      return { success: true };
    } catch (err) {
      this.logger.error(`[Stream] Failed to register device for ${userId}:`, err);
      return { success: false };
    }
  }

  /**
   * Remove a device when the user logs out or disables notifications.
   */
  async removeDevice(userId: string, pushToken: string): Promise<{ success: boolean }> {
    if (!this.streamClient) return { success: false };

    try {
      await this.streamClient.deleteDevice({
        id: pushToken,
        user_id: userId,
      });
      this.logger.log(`[Stream] Removed device for user ${userId}`);
      return { success: true };
    } catch (err) {
      this.logger.error(`[Stream] Failed to remove device for ${userId}:`, err);
      return { success: false };
    }
  }
}
