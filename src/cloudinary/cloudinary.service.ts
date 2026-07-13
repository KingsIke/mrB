import { Inject, Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import * as streamifier from 'streamifier';
import { CLOUDINARY } from './cloudinary.provider';

export type CloudinaryResourceType = 'image' | 'video' | 'auto';

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private readonly cloudinary: typeof v2) {}

  uploadFile(
    file: Express.Multer.File,
    options: { folder?: string; resourceType?: CloudinaryResourceType } = {},
  ): Promise<UploadApiResponse> {
    const { folder, resourceType = 'auto' } = options;

    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error: UploadApiErrorResponse | undefined, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error);
          }
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async destroyFile(publicId: string, resourceType: CloudinaryResourceType = 'image'): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
