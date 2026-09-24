import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Length, Min, IsIn, Max } from 'class-validator';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
export class PurchaseCoinsDto {
  @ApiProperty({ description: 'Number of Campus Coins to purchase', example: 500, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(100000)
  coins: number;

  @ApiProperty({
    description: 'Set to "web" to return to the 3names.ng top-up page after paying',
    required: false,
    enum: ['web'],
  })
  @IsOptional()
  @IsIn(['web'])
  returnTo?: 'web';
}


export class ConvertEarningsDto {
  @ApiProperty({ description: 'Amount in NGN from earned gift balance to convert into coins', example: 500 })
  @IsNumber()
  @IsPositive()
  amountNgn: number;
}

export class WithdrawEarningsDto {
  @ApiProperty({ description: 'Amount in NGN to withdraw', example: 5000 })
  @IsNumber()
  @IsPositive()
  amountNgn: number;

  @ApiProperty({ description: 'ID of one of the user\'s saved withdrawal accounts', example: 'a1b2c3d4-...' })
  @IsString()
  @IsNotEmpty()
  savedAccountId: string;
}

export class AddWithdrawalAccountDto {
  @ApiProperty({ description: 'Bank code (e.g., 058 for GTBank)', example: '058' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiPropertyOptional({ description: 'Human-readable bank name', example: 'GTBank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ description: '10-digit NUBAN account number', example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;
}


export class ResolveAccountDto {
  @ApiProperty({ example: '0123456789', description: '10-digit NGN account number' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;

  @ApiProperty({ example: '058', description: 'Bank code or bank slug' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;
}