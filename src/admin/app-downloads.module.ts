import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDownloadsController } from './app-downloads.controller';
import { AppDownloadsService } from './app-downloads.service';
import { AppDownloadClick } from './entities/app-download-click.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppDownloadClick])],
  controllers: [AppDownloadsController],
  providers: [AppDownloadsService],
  exports: [AppDownloadsService],
})
export class AppDownloadsModule {}
