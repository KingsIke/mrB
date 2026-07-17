import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(OmitType(CreatePostDto, ['taggedUserIds'] as const)) {}
