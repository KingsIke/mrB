import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Length, Min } from 'class-validator';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
export class PurchaseCoinsDto {
  @ApiProperty({ description: 'Number of Campus Coins to purchase', example: 500, minimum: 1 })
  @IsInt()
  @Min(1)
  coins: number;
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

  @ApiProperty({ description: 'Bank code (e.g., 058 for GTBank)', example: '058' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ description: '10-digit NUBAN account number', example: '0123456789' })
  @IsString()
  @IsNotEmpty()
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