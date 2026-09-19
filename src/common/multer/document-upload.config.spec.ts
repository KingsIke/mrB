import { BadRequestException } from '@nestjs/common';
import {
  documentUploadOptions,
  resolveUploadMimetype,
} from './document-upload.config';

type TestFile = Pick<Express.Multer.File, 'mimetype' | 'originalname'>;

const file = (mimetype: string, originalname: string): TestFile => ({
  mimetype,
  originalname,
});

/** Runs the configured fileFilter and reports the decision. */
function filter(
  options: Parameters<typeof documentUploadOptions>[0],
  upload: TestFile,
): { accepted: boolean; mimetype: string; error?: unknown } {
  const { fileFilter } = documentUploadOptions(options);
  const mutated = { ...upload };
  let accepted = false;
  let error: unknown;

  (fileFilter as any)({}, mutated, (err: unknown, accept?: boolean) => {
    error = err ?? undefined;
    accepted = !!accept;
  });

  return { accepted, mimetype: mutated.mimetype, error };
}

describe('documentUploadOptions', () => {
  describe('resolveUploadMimetype', () => {
    it('keeps concrete, supported types', () => {
      expect(resolveUploadMimetype(file('image/png', 'a.png'))).toBe('image/png');
      expect(resolveUploadMimetype(file('application/pdf', 'a.pdf'))).toBe(
        'application/pdf',
      );
    });

    it('normalises the non-standard image/jpg', () => {
      expect(resolveUploadMimetype(file('image/jpg', 'a.jpg'))).toBe('image/jpeg');
    });

    it('falls back to the extension for vague mobile content types', () => {
      expect(resolveUploadMimetype(file('application/octet-stream', 'a.jpg'))).toBe(
        'image/jpeg',
      );
      expect(resolveUploadMimetype(file('image/*', 'a.PDF'))).toBe('application/pdf');
      expect(resolveUploadMimetype(file('', 'a.heic'))).toBe('image/heic');
    });

    it('rejects unsupported types and extensions', () => {
      expect(resolveUploadMimetype(file('text/plain', 'a.jpg'))).toBe('text/plain');
      expect(resolveUploadMimetype(file('', 'a.exe'))).toBeUndefined();
      expect(
        resolveUploadMimetype(file('application/octet-stream', 'no-extension')),
      ).toBeUndefined();
    });
  });

  describe('fileFilter', () => {
    it('accepts an Android-style upload with no content type', () => {
      const result = filter({}, file('application/octet-stream', 'ID-CARD.JPG'));
      expect(result.accepted).toBe(true);
      expect(result.mimetype).toBe('image/jpeg');
    });

    it('accepts a PDF only when allowPdf is set', () => {
      const pdf = file('application/octet-stream', 'letter.pdf');
      expect(filter({ allowPdf: true }, pdf).accepted).toBe(true);
      expect(filter({}, pdf).accepted).toBe(false);
    });

    it('rejects unsupported files with a 400, not a bare Error', () => {
      const result = filter({}, file('application/zip', 'archive.zip'));
      expect(result.accepted).toBe(false);
      expect(result.error).toBeInstanceOf(BadRequestException);
      expect((result.error as BadRequestException).message).toContain(
        'Unsupported file type',
      );
    });
  });
});
