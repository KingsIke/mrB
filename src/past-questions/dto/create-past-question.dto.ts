import { IsNotEmpty, IsString, IsArray, ArrayMinSize, IsOptional, IsInt, Min } from 'class-validator';

class FileDto {
  @IsString()
  name: string;

  @IsString()
  uri: string;

  @IsOptional()
  size?: number;
}

export class CreatePastQuestionDto {
  @IsNotEmpty()
  @IsString()
  level: string;

  @IsNotEmpty()
  @IsString()
  course: string;


  //   @IsNotEmpty()
  // @IsString()
  // courseCode: string;

  @IsNotEmpty()
  @IsString()
  session: string;

  @IsNotEmpty()
  @IsString()
  semester: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  files?: FileDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCoins?: number;
}
