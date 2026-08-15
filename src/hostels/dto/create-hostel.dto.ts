import { 
  IsArray, 
  IsBoolean, 
  IsEnum, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsUrl 
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { HostelStatus } from '../entities/hostel-listing.entity';

export class CreateHostelDto {
  // Basic Details
  @IsString()
  hostelName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  school?: string;

  // Pricing (Transformed from Multipart strings to Numbers)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthlyRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cautionFee?: number;

  // Room Info
  @IsOptional()
  @IsString()
  roomType?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  availableRooms?: number;

  @IsOptional()
  @IsString()
  bedrooms?: string;

  @IsOptional()
  @IsString()
  bathrooms?: string;

  // Amenities & Rules
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  amenities?: string[];

  @IsOptional()
  @IsString()
  curfew?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  visitorsAllowed?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  petsAllowed?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  smokingAllowed?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  lookingForRoommate?: boolean;

  // Contact Info
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  // Media & Meta
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(HostelStatus)
  status?: HostelStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAvailable?: boolean;
}