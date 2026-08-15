import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceItem } from './entities/marketplace-item.entity';
import { MarketplaceLike } from './entities/marketplace-like.entity';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { User } from 'src/users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplaceItem, MarketplaceLike, User]),
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
