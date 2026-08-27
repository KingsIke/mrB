import { MaterialCategory } from '../entities/campus-material.entity';

export class CreateMaterialDto {
  title: string;
  description?: string;
  category: MaterialCategory;
  course?: string;
  courseCode?: string;
  level?: string;
  author?: string;
  isbn?: string;
  dueDate?: string;
  labSession?: string;
  files?: { name: string; uri: string; size?: number }[];
  coverImage?: string;
  externalLink?: string;
  priceCoins?: number;
}
