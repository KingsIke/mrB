import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GiftsService } from './gifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendGiftDto } from './dto/send-gift.dto';
import { CreateGiftDto } from './dto/create-gift.dto';

@ApiTags('Gifts')
@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the gift catalog' })
  async listGifts() {
    return this.giftsService.listGifts();
  }

    @Post()
  // @UseGuards(JwtAuthGuard) 
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Create and save a new gift' })
  async createGift(@Body() dto: CreateGiftDto) {
    return this.giftsService.createGift(dto);
  }


  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a gift to a post or story' })
  async sendGift(@CurrentUser('userId') userId: string, @Body() dto: SendGiftDto) {
    return this.giftsService.sendGift(userId, dto);
  }



  @Post('claim-daily')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim the daily free gift/coin' })
  async claimDaily(@CurrentUser('userId') userId: string) {
    await this.giftsService.claimDaily(userId);
    return { claimed: true };
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed the gift catalog (dev only)' })
  async seed() {
    await this.giftsService.seedGifts();
    return { message: 'Gifts seeded successfully' };
  }
}
