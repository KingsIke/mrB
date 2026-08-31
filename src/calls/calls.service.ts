import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CallHistory, CallType, CallStatus } from './entities/call-history.entity';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(CallHistory)
    private readonly callHistoryRepository: Repository<CallHistory>,
  ) {}

  /**
   * Record a new call (created when the caller initiates).
   */
  async createCall(data: {
    callerId: string;
    calleeId: string;
    callType: CallType;
    streamCallId?: string;
  }): Promise<CallHistory> {
    const call = this.callHistoryRepository.create({
      callerId: data.callerId,
      calleeId: data.calleeId,
      callType: data.callType,
      streamCallId: data.streamCallId || null,
      status: CallStatus.MISSED, // Default to missed until accepted
    });

    const saved = await this.callHistoryRepository.save(call);
    this.logger.log(`[Calls] Created call ${saved.id} from ${data.callerId} to ${data.calleeId}`);
    return saved;
  }

  /**
   * Mark a call as accepted (when callee picks up).
   */
  async acceptCall(callId: string): Promise<CallHistory> {
    const call = await this.callHistoryRepository.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    call.status = CallStatus.ACCEPTED;
    call.startedAt = new Date();

    const saved = await this.callHistoryRepository.save(call);
    this.logger.log(`[Calls] Call ${callId} accepted`);
    return saved;
  }

  /**
   * End a call and calculate duration.
   */
  async endCall(callId: string, status?: CallStatus): Promise<CallHistory> {
    const call = await this.callHistoryRepository.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    call.endedAt = new Date();

    if (status) {
      call.status = status;
    }

    // Calculate duration if call was accepted
    if (call.startedAt && call.status === CallStatus.ACCEPTED) {
      call.duration = Math.floor(
        (call.endedAt.getTime() - call.startedAt.getTime()) / 1000,
      );
    }

    const saved = await this.callHistoryRepository.save(call);
    this.logger.log(`[Calls] Call ${callId} ended — status: ${saved.status}, duration: ${saved.duration}s`);
    return saved;
  }

  /**
   * Mark a call as rejected.
   */
  async rejectCall(callId: string): Promise<CallHistory> {
    return this.endCall(callId, CallStatus.REJECTED);
  }

  /**
   * Mark a call as cancelled (caller hung up before answer).
   */
  async cancelCall(callId: string): Promise<CallHistory> {
    return this.endCall(callId, CallStatus.CANCELLED);
  }

  /**
   * Get call history for a user (both sent and received).
   * Returns the most recent calls, deduplicated by conversation partner.
   */
  async getCallHistory(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const qb = this.callHistoryRepository
      .createQueryBuilder('call')
      .leftJoinAndSelect('call.caller', 'caller')
      .leftJoinAndSelect('call.callee', 'callee')
      .where('call.callerId = :userId OR call.calleeId = :userId', { userId })
      .orderBy('call.createdAt', 'DESC');

    const total = await qb.getCount();

    const calls = await qb.skip(skip).take(limit).getMany();

    // Format the response to show the "other" user
    const items = calls.map((call) => ({
      id: call.id,
      callType: call.callType,
      status: call.status,
      duration: call.duration,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      isIncoming: call.calleeId === userId,
      otherUser: call.callerId === userId
        ? {
            id: call.callee.id,
            username: call.callee.username,
            firstName: call.callee.firstName,
            lastName: call.callee.lastName,
            profilePictureUrl: call.callee.profilePictureUrl,
          }
        : {
            id: call.caller.id,
            username: call.caller.username,
            firstName: call.caller.firstName,
            lastName: call.caller.lastName,
            profilePictureUrl: call.caller.profilePictureUrl,
          },
    }));

    return { items, total, page, limit };
  }

  /**
   * Get call history between two specific users.
   */
  async getCallHistoryBetween(
    userId1: string,
    userId2: string,
    limit = 20,
  ): Promise<CallHistory[]> {
    return this.callHistoryRepository.find({
      where: [
        { callerId: userId1, calleeId: userId2 },
        { callerId: userId2, calleeId: userId1 },
      ],
      relations: ['caller', 'callee'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get missed calls count for a user.
   */
  async getMissedCallsCount(userId: string): Promise<number> {
    return this.callHistoryRepository.count({
      where: {
        calleeId: userId,
        status: CallStatus.MISSED,
      },
    });
  }

  /**
   * Mark all missed calls as read (for a user).
   */
  async markMissedCallsRead(userId: string): Promise<{ count: number }> {
    const result = await this.callHistoryRepository.update(
      {
        calleeId: userId,
        status: CallStatus.MISSED,
      },
      { status: CallStatus.CANCELLED }, // Mark as cancelled so they don't show as unread
    );

    return { count: result.affected || 0 };
  }
}
