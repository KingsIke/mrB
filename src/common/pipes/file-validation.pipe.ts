import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedTypes: string[];

  constructor(
    maxSize: number = 5 * 1024 * 1024, // 5MB default
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp'],
  ) {
    this.maxSize = maxSize;
    this.allowedTypes = allowedTypes;
  }

  transform(value: Express.Multer.File) {
    if (!value) {
      return value;
    }

    if (value.size > this.maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxSize / 1024 / 1024}MB`,
      );
    }

    if (!this.allowedTypes.includes(value.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`,
      );
    }

    return value;
  }
}
