import { memoryStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { AttachmentType } from '../../groups/entities/message-attachment.entity';

const ALLOWED_MIMES = [
  // images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // video
  'video/mp4',
  'video/quicktime',
  'video/webm',
  // audio (voice notes)
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  // generic files
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

export const messageAttachmentUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Unsupported attachment type'), false);
    }
  },
};

export function resolveAttachmentType(mimetype: string): AttachmentType {
  if (mimetype.startsWith('image/')) return AttachmentType.IMAGE;
  if (mimetype.startsWith('video/')) return AttachmentType.VIDEO;
  if (mimetype.startsWith('audio/')) return AttachmentType.AUDIO;
  return AttachmentType.FILE;
}
