import { cloudinary } from '../config/cloudinary';
import type { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { AppError } from '../utils/AppError';

/**
 * Document type identifiers for KYC uploads
 */
export type KycDocumentType = 
  | 'taxDocument' 
  | 'registrationDoc' 
  | 'businessLicense' 
  | 'idProof';

/**
 * Media type for listing uploads
 */
export type ListingMediaType = 'image' | 'video';

/**
 * Upload result containing the public_id
 */
export interface UploadResult {
  publicId: string;
  format: string;
  bytes: number;
}

/**
 * Options for generating signed URLs
 */
export interface SignedUrlOptions {
  expiresInSeconds?: number;
  watermarkText?: string;
}

/**
 * Upload a KYC document to Cloudinary
 * Documents are stored in a private folder per organization
 * 
 * IMPORTANT: Do NOT include file extension in publicId - Cloudinary handles this automatically
 */
export const uploadKycDocument = async (
  fileBuffer: Buffer,
  orgId: string,
  docType: KycDocumentType,
  extension?: string
): Promise<UploadResult> => {
  const folder = `chirpynosh/kyc/${orgId}`;
  // Don't include extension in publicId - Cloudinary manages format separately
  const publicId = `${folder}/${docType}_${Date.now()}`;

  // Determine resource type based on extension
  const isPdf = extension?.toLowerCase().replace('.', '') === 'pdf';
  const resourceType = isPdf ? 'raw' : 'image';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        type: 'private', // Private upload - requires signed URLs for access
        overwrite: true,
        invalidate: true,
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(AppError.internal('Failed to upload document'));
          return;
        }

        if (!result) {
          reject(AppError.internal('No upload result received'));
          return;
        }

        // Store format info with public_id for proper retrieval
        resolve({
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Strip file extension from public_id if present
 * Cloudinary stores public_id without extension, but old code may have included it
 * 
 * NOTE: Only strip common image extensions. Cloudinary's actual behavior depends on 
 * resource_type used during upload. When using 'auto', it may keep the extension.
 */
const normalizePublicId = (publicId: string): string => {
  // Don't strip extensions - Cloudinary may have stored them as part of public_id
  // when using resource_type: 'auto' during upload
  return publicId;
};

/**
 * Generate a signed URL for secure document access
 * URL expires after the specified time (default: 60 seconds)
 * Uses private_download_url for proper time-limited expiration
 */
export const generateSignedUrl = (
  publicId: string,
  options: SignedUrlOptions = {}
): string => {
  const { expiresInSeconds = 60 } = options;
  
  // Normalize publicId
  const cleanPublicId = normalizePublicId(publicId);

  // Calculate expiration timestamp (Unix time)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Use private_download_url for proper expiring URLs
  // This generates a time-limited signed URL that actually expires
  const url = cloudinary.utils.private_download_url(cleanPublicId, 'jpg', {
    expires_at: expirationTimestamp,
    resource_type: 'image',
    type: 'private',
  });

  return url;
};

/**
 * Generate a signed URL for raw documents (PDFs, etc.)
 * Uses private_download_url for proper time-limited expiration
 */
export const generateSignedRawUrl = (
  publicId: string,
  expiresInSeconds: number = 60
): string => {
  // Normalize publicId
  const cleanPublicId = normalizePublicId(publicId);
  
  const expirationTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Use private_download_url for proper expiring URLs
  return cloudinary.utils.private_download_url(cleanPublicId, 'pdf', {
    expires_at: expirationTimestamp,
    resource_type: 'raw',
    type: 'private',
  });
};

/**
 * Delete a document from Cloudinary
 */
export const deleteDocument = async (publicId: string, isRaw: boolean = false): Promise<void> => {
  try {
    const cleanPublicId = normalizePublicId(publicId);
    // Try both types since we might have legacy 'private' or new 'authenticated' uploads
    await cloudinary.uploader.destroy(cleanPublicId, { 
      type: 'private',
      resource_type: isRaw ? 'raw' : 'image',
      invalidate: true,
    });
  } catch (error) {
    console.error('Failed to delete document:', error);
    // Don't throw - deletion failures shouldn't block operations
  }
};

/**
 * Check if a public_id looks like an image (for rendering watermarks)
 * Returns false for PDFs which should use raw resource type
 */
export const isImageDocument = (publicId: string): boolean => {
  const lowerPublicId = publicId.toLowerCase();
  // PDFs are NOT images - they need raw resource type
  if (lowerPublicId.includes('.pdf') || lowerPublicId.includes('pdf')) {
    return false;
  }
  // Check if it has image extension or doesn't have any extension (assume image)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const hasImageExt = imageExtensions.some(ext => lowerPublicId.includes(ext));
  const hasAnyExt = ['.pdf', ...imageExtensions].some(ext => lowerPublicId.includes(ext));
  
  // If has image extension OR no extension at all, treat as image
  return hasImageExt || !hasAnyExt;
};

// ============================================================================
// LISTING MEDIA UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload a listing image to Cloudinary
 * Images are stored in a public folder for easy access
 */
export const uploadListingImage = async (
  fileBuffer: Buffer,
  orgId: string,
): Promise<UploadResult> => {
  const folder = `chirpynosh/listings/${orgId}`;
  const publicId = `${folder}/img_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        type: 'upload', // Public upload for listing images
        overwrite: true,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' }, // Max dimensions
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          console.error('Cloudinary image upload error:', error);
          reject(AppError.internal('Failed to upload image'));
          return;
        }

        if (!result) {
          reject(AppError.internal('No upload result received'));
          return;
        }

        resolve({
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload a listing video to Cloudinary
 * Videos are stored in a public folder with size/duration limits
 */
export const uploadListingVideo = async (
  fileBuffer: Buffer,
  orgId: string,
): Promise<UploadResult> => {
  const folder = `chirpynosh/listings/${orgId}`;
  const publicId = `${folder}/vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'video',
        type: 'upload', // Public upload for listing videos
        overwrite: true,
        eager: [
          { width: 720, height: 720, crop: 'limit', quality: 'auto' },
        ],
        eager_async: true,
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          console.error('Cloudinary video upload error:', error);
          reject(AppError.internal('Failed to upload video'));
          return;
        }

        if (!result) {
          reject(AppError.internal('No upload result received'));
          return;
        }

        resolve({
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Generate a public URL for listing media (images/videos)
 */
export const getListingMediaUrl = (
  publicId: string,
  type: ListingMediaType = 'image'
): string => {
  const options = type === 'video' 
    ? { resource_type: 'video' as const, secure: true }
    : { resource_type: 'image' as const, secure: true };
  
  return cloudinary.url(publicId, options);
};

/**
 * Delete listing media from Cloudinary
 */
export const deleteListingMedia = async (
  publicId: string,
  type: ListingMediaType = 'image'
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { 
      type: 'upload',
      resource_type: type,
      invalidate: true,
    });
  } catch (error) {
    console.error('Failed to delete listing media:', error);
    // Don't throw - deletion failures shouldn't block operations
  }
};

// ============================================================================
// AVATAR UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload a user avatar to Cloudinary
 * Avatars are stored in a public folder for easy access
 */
export const uploadAvatar = async (
  fileBuffer: Buffer,
  userId: string,
): Promise<UploadResult> => {
  const folder = `chirpynosh/avatars`;
  const publicId = `${folder}/user_${userId}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        type: 'upload', // Public upload for avatars
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // Square crop focused on face
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          console.error('Cloudinary avatar upload error:', error);
          reject(AppError.internal('Failed to upload avatar'));
          return;
        }

        if (!result) {
          reject(AppError.internal('No upload result received'));
          return;
        }

        resolve({
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Generate a public URL for avatar
 */
export const getAvatarUrl = (publicId: string): string => {
  return cloudinary.url(publicId, { 
    resource_type: 'image', 
    secure: true,
    transformation: [
      { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
  });
};

/**
 * Delete avatar from Cloudinary
 */
export const deleteAvatar = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { 
      type: 'upload',
      resource_type: 'image',
      invalidate: true,
    });
  } catch (error) {
    console.error('Failed to delete avatar:', error);
    // Don't throw - deletion failures shouldn't block operations
  }
};
