import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentReport } from '../posts/entities/content-report.entity';
import { Story } from '../stories/entities/story.entity';
import { MarketplaceItem } from '../marketplace/entities/marketplace-item.entity';
import { HostelListing } from '../hostels/entities/hostel-listing.entity';
import { PastQuestion } from '../past-questions/entities/past-question.entity';
import { CampusMaterial } from '../materials/entities/campus-material.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentReport,
      Story,
      MarketplaceItem,
      HostelListing,
      PastQuestion,
      CampusMaterial,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
