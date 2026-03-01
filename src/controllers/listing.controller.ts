import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as listingService from '../services/listing.service';
import * as uploadService from '../services/upload.service';

/**
 * Listing Controller
 * Handles HTTP requests for supplier listing management
 */

// ============================================================================
// LISTING CRUD
// ============================================================================

/**
 * POST /listings
 * Create a new listing
 */
export const createListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listing = await listingService.createListing(req.user!.userId, req.body);

  res.status(201).json({ success: true, listing });
});

/**
 * GET /listings
 * Get supplier's own listings with filters and pagination
 */
export const getSupplierListings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
  const pageQuery = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
  const limitQuery = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  const result = await listingService.getSupplierListings(req.user!.userId, {
    ...(statusQuery && { status: statusQuery as 'ACTIVE' | 'PAUSED' | 'SOLD_OUT' | 'EXPIRED' | 'CANCELLED' }),
    ...(pageQuery && { page: pageQuery }),
    ...(limitQuery && { limit: limitQuery }),
  });

  res.json({ success: true, ...result });
});

/**
 * GET /listings/:id
 * Get a single listing by ID
 */
export const getListingById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  const listing = await listingService.getListingById(req.user!.userId, listingId);

  res.json({ success: true, listing });
});

/**
 * PATCH /listings/:id
 * Update a listing
 */
export const updateListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  const listing = await listingService.updateListing(req.user!.userId, listingId, req.body);

  res.json({ success: true, listing });
});

/**
 * PATCH /listings/:id/pause
 * Pause a listing
 */
export const pauseListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  const listing = await listingService.pauseListing(req.user!.userId, listingId);

  res.json({ success: true, listing });
});

/**
 * PATCH /listings/:id/resume
 * Resume a paused listing
 */
export const resumeListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  const listing = await listingService.resumeListing(req.user!.userId, listingId);

  res.json({ success: true, listing });
});

/**
 * DELETE /listings/:id
 * Delete a listing (soft cancel)
 */
export const deleteListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  await listingService.deleteListing(req.user!.userId, listingId);

  res.json({ success: true, message: 'Listing cancelled successfully' });
});

// ============================================================================
// SUPPLIER CLAIM MANAGEMENT
// ============================================================================

/**
 * GET /listings/claims
 * Get claims for supplier's listings
 */
export const getSupplierClaims = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
  const listingIdQuery = typeof req.query.listingId === 'string' ? req.query.listingId : undefined;
  const pageQuery = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
  const limitQuery = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  const result = await listingService.getSupplierClaims(req.user!.userId, {
    ...(statusQuery && { status: statusQuery as 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' }),
    ...(listingIdQuery && { listingId: listingIdQuery }),
    ...(pageQuery && { page: pageQuery }),
    ...(limitQuery && { limit: limitQuery }),
  });

  res.json({ success: true, ...result });
});

/**
 * POST /listings/claims/:id/verify
 * Verify pickup OTP for a claim
 */
export const verifyPickupOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const claimId = String(req.params.id);
  if (!claimId) {
    res.status(400).json({ success: false, message: 'Claim ID required' });
    return;
  }

  const claim = await listingService.verifyPickupOtp(
    req.user!.userId,
    claimId,
    req.body.otp
  );

  res.json({ success: true, claim, message: 'Pickup verified successfully' });
});

// ============================================================================
// MEDIA UPLOAD
// ============================================================================

/**
 * POST /listings/upload/image
 * Upload a listing image to Cloudinary
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    throw AppError.badRequest('No image file provided');
  }

  const org = await listingService.getSupplierOrg(req.user!.userId);

  const result = await uploadService.uploadListingImage(
    req.file.buffer,
    org.id
  );

  res.status(201).json({
    success: true,
    publicId: result.publicId,
    url: uploadService.getListingMediaUrl(result.publicId, 'image'),
  });
});

/**
 * POST /listings/upload/video
 * Upload a listing video to Cloudinary
 */
export const uploadVideo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    throw AppError.badRequest('No video file provided');
  }

  const org = await listingService.getSupplierOrg(req.user!.userId);

  const result = await uploadService.uploadListingVideo(
    req.file.buffer,
    org.id
  );

  res.status(201).json({
    success: true,
    publicId: result.publicId,
    url: uploadService.getListingMediaUrl(result.publicId, 'video'),
  });
});

/**
 * DELETE /listings/upload
 * Delete uploaded media from Cloudinary
 */
export const deleteMedia = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const publicId = req.body.publicId as string;
  if (!publicId) {
    throw AppError.badRequest('Public ID required');
  }

  const org = await listingService.getSupplierOrg(req.user!.userId);
  if (!publicId.includes(`/listings/${org.id}/`)) {
    throw AppError.forbidden('You can only delete your own media');
  }

  const isVideo = publicId.includes('/vid_');
  await uploadService.deleteListingMedia(publicId, isVideo ? 'video' : 'image');

  res.json({ success: true, message: 'Media deleted successfully' });
});
