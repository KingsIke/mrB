import { memoryStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

export const mediaUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB, covers short video clips
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Only JPEG/PNG/WebP images or MP4/MOV/WebM videos are allowed'), false);
    }
  },
};
