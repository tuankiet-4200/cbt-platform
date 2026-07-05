import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CONTRIBUTION_BYTES = 50 * 1024 * 1024;
const CONTRIBUTION_SIGNED_URL_TTL_SECONDS = 15 * 60;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const CONTRIBUTION_FILE_TYPES: Record<string, 'PDF' | 'DOCX'> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

export interface StoredAsset {
  bucket: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly imagesBucket: string;
  private readonly contributionsBucket: string;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage uploads');
    }

    this.supabase = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.imagesBucket = this.configService.get<string>('SUPABASE_IMAGES_BUCKET', 'images');
    this.contributionsBucket = this.configService.get<string>('SUPABASE_CONTRIBUTIONS_BUCKET', 'contributions');
  }

  async uploadQuestionImage(file: Express.Multer.File, adminUserId: string): Promise<StoredAsset> {
    this.assertFilePresent(file);
    this.assertMaxSize(file, MAX_IMAGE_BYTES, 'Image');
    this.assertAllowedImage(file);

    const path = this.buildPath('questions', adminUserId, file.originalname, file.mimetype);
    await this.upload(this.imagesBucket, path, file);

    const { data } = this.supabase.storage.from(this.imagesBucket).getPublicUrl(path);

    return {
      bucket: this.imagesBucket,
      path,
      url: data.publicUrl,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async uploadContributionFile(file: Express.Multer.File, userId: string): Promise<StoredAsset & { fileType: 'PDF' | 'DOCX' }> {
    this.assertFilePresent(file);
    this.assertMaxSize(file, MAX_CONTRIBUTION_BYTES, 'Contribution file');

    const fileType = CONTRIBUTION_FILE_TYPES[file.mimetype];
    if (!fileType) {
      throw new BadRequestException('Contribution file must be PDF or DOCX');
    }

    this.assertContributionMagicBytes(file, fileType);

    const path = this.buildPath('submissions', userId, file.originalname, file.mimetype);
    await this.upload(this.contributionsBucket, path, file);

    return {
      bucket: this.contributionsBucket,
      path,
      url: this.toStorageUri(this.contributionsBucket, path),
      mimeType: file.mimetype,
      size: file.size,
      fileType,
    };
  }

  async createContributionSignedUrl(fileUrl: string) {
    const { bucket, path } = this.parseStorageUri(fileUrl);
    if (bucket !== this.contributionsBucket) {
      throw new BadRequestException('Contribution file is not stored in the contributions bucket');
    }

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, CONTRIBUTION_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(error?.message ?? 'Failed to create signed URL');
    }

    return {
      signedUrl: data.signedUrl,
      expiresIn: CONTRIBUTION_SIGNED_URL_TTL_SECONDS,
    };
  }

  private async upload(bucket: string, path: string, file: Express.Multer.File) {
    const { error } = await this.supabase.storage.from(bucket).upload(path, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private toStorageUri(bucket: string, path: string) {
    return `supabase://${bucket}/${path}`;
  }

  private parseStorageUri(uri: string) {
    const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(uri);
    if (!match) {
      throw new BadRequestException('Invalid storage URI');
    }

    return {
      bucket: match[1],
      path: match[2],
    };
  }

  private assertFilePresent(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
  }

  private assertMaxSize(file: Express.Multer.File, maxBytes: number, label: string) {
    if (file.size > maxBytes) {
      throw new BadRequestException(`${label} exceeds ${Math.floor(maxBytes / 1024 / 1024)}MB limit`);
    }
  }

  private assertAllowedImage(file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Image must be PNG, JPEG, WEBP, or SVG');
    }

    if (!this.hasValidImageSignature(file)) {
      throw new BadRequestException('Image file signature does not match its MIME type');
    }
  }

  private assertContributionMagicBytes(file: Express.Multer.File, fileType: 'PDF' | 'DOCX') {
    if (fileType === 'PDF' && !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new BadRequestException('PDF file signature is invalid');
    }

    if (fileType === 'DOCX' && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new BadRequestException('DOCX file signature is invalid');
    }
  }

  private hasValidImageSignature(file: Express.Multer.File) {
    if (file.mimetype === 'image/png') {
      return file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (file.mimetype === 'image/jpeg') {
      return file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
    }

    if (file.mimetype === 'image/webp') {
      return file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }

    if (file.mimetype === 'image/svg+xml') {
      const prefix = file.buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
      return prefix.startsWith('<svg') || prefix.startsWith('<?xml');
    }

    return false;
  }

  private buildPath(prefix: string, ownerId: string, originalName: string, mimeType: string) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const extension = this.extensionFor(originalName, mimeType);
    return `${prefix}/${ownerId}/${date}/${randomUUID()}${extension}`;
  }

  private extensionFor(originalName: string, mimeType: string) {
    const rawExtension = extname(originalName).toLowerCase();
    if (rawExtension) return rawExtension;

    switch (mimeType) {
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      case 'image/svg+xml':
        return '.svg';
      case 'application/pdf':
        return '.pdf';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      default:
        return '';
    }
  }
}
