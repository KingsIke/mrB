import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Image types accepted for verification documents and profile pictures. */
const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const PDF_MIME = 'application/pdf';

/**
 * MIME types keyed by file extension, used when the client does not send a
 * concrete content type. Android/React Native multipart clients regularly send
 * `application/octet-stream` (or no type at all) for perfectly valid files, so
 * rejecting on the declared MIME alone drops legitimate uploads.
 */
const EXTENSION_MIMES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': PDF_MIME,
};

/**
 * Declared types that carry no information about the actual file. Anything else
 * is treated as a deliberate claim and must be in the allow-list.
 */
const AMBIGUOUS_MIMES = [
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/*',
  'image/*',
];

/**
 * Resolves the real MIME type of an upload, tolerating the vague content types
 * that mobile clients send. Returns `undefined` when the file is not supported.
 */
export function resolveUploadMimetype(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string | undefined {
  const declared = (file.mimetype || '').toLowerCase().trim();

  // Some clients use the non-standard image/jpg for JPEGs.
  if (declared === 'image/jpg') return 'image/jpeg';
  if (!AMBIGUOUS_MIMES.includes(declared)) return declared;

  return EXTENSION_MIMES[extname(file.originalname || '').toLowerCase()];
}

export interface DocumentUploadOptions {
  /** Also accept application/pdf. Defaults to false. */
  allowPdf?: boolean;
  /** Maximum file size in bytes. Defaults to 5MB. */
  maxFileSize?: number;
}

/**
 * Multer options for student document uploads (ID cards, admission letters,
 * profile pictures). Unsupported files are rejected with a 400 — a bare `Error`
 * from a multer file filter surfaces to the client as a 500.
 */
export function documentUploadOptions({
  allowPdf = false,
  maxFileSize = 5 * 1024 * 1024,
}: DocumentUploadOptions = {}): MulterOptions {
  const allowedMimes = allowPdf ? [...IMAGE_MIMES, PDF_MIME] : [...IMAGE_MIMES];
  const allowedDescription = allowPdf
    ? 'JPEG, PNG, WebP or HEIC images, or a PDF'
    : 'JPEG, PNG, WebP or HEIC images';

  return {
    storage: memoryStorage(),
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, callback) => {
      const mimetype = resolveUploadMimetype(file);

      if (mimetype && allowedMimes.includes(mimetype)) {
        // Normalise the MIME on the file so handlers see the real type even when
        // the client sent a vague one (e.g. octet-stream for a .pdf).
        file.mimetype = mimetype;
        callback(null, true);
        return;
      }

      const received = file.mimetype ? ` "${file.mimetype}"` : '';
      callback(
        new BadRequestException(
          `Unsupported file type${received}. Allowed: ${allowedDescription}`,
        ),
        false,
      );
    },
  };
}
