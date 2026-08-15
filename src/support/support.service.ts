import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportRequest, SupportRequestStatus } from './entities/support-request.entity';
import { ReportProblemDto } from './dto/report-problem.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
  ) {}

  async reportProblem(userId: string | null, dto: ReportProblemDto): Promise<SupportRequest> {
    const request = this.supportRequestRepository.create({
      userId,
      category: dto.category,
      subject: dto.subject ?? null,
      message: dto.message,
      status: SupportRequestStatus.OPEN,
    });

    return this.supportRequestRepository.save(request);
  }
}
