import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import { CoinsService } from './coins.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConvertEarningsDto, PurchaseCoinsDto, ResolveAccountDto, WithdrawEarningsDto } from './dto/purchase-coins.dto';
import { CursorPaginationDto } from '../common/pagination/cursor-pagination.dto';



@ApiTags('Coins')
@Controller('coins')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my Campus Coins balance and earned gift cash balance' })
  async getBalance(@CurrentUser('userId') userId: string) {
    return this.coinsService.getBalance(userId);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my transaction history' })
  async listTransactions(@CurrentUser('userId') userId: string, @Query() pagination: CursorPaginationDto) {
    return this.coinsService.listTransactions(userId, pagination);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a Campus Coins purchase via Paystack' })
  async purchase(@CurrentUser('userId') userId: string, @Body() dto: PurchaseCoinsDto) {
    return this.coinsService.purchase(userId, dto);
  }

  @Post('convert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert gift earnings (NGN) into spendable Campus Coins' })
  async convertEarnedToCoins(
    @CurrentUser('userId') userId: string,
    @Body() dto: ConvertEarningsDto,
  ) {
    return this.coinsService.convertEarnedToCoins(userId, dto.amountNgn);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw gift earnings (NGN) to bank account' })
  async withdrawEarnings(
    @CurrentUser('userId') userId: string,
    @Body() dto: WithdrawEarningsDto,
  ) {
    return this.coinsService.withdrawEarnings(userId, dto.amountNgn, {
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
    });
  }

  @Post('resolve-account')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Resolve bank account number to get account holder name' })
async resolveAccountName(@Body() dto: ResolveAccountDto) {
  return this.coinsService.resolveAccountName(dto);
}

  // Intentionally unguarded — Paystack calls this with no user session, so JwtAuthGuard
  // doesn't apply here. Authenticity is instead verified via the HMAC signature below.
  @Post('webhook/paystack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook callback' })
  async paystackWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody || !this.coinsService.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.coinsService.handleWebhookEvent(request.body);
    return { received: true };
  }
}