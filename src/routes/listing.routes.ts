import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireVerifiedRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as listingService from '../services/listing.service';
import * as uploadService from '../services/upload.service';
import {
  createListingSchema,
  updateListingSchema,
  getListingSchema,
  listListingsSchema,
  pauseResumeListingSchema,
  listClaimsSchema,
  verifyPickupOtpSchema,
} from '../schema/listing.schema';

const router = Router();

// Configure multer for memory storage (max 10MB for images, 50MB for video)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      cb(new Error('Only video files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// All routes require authentication and verified FOOD_SUPPLIER role
router.use(authenticate);
router.use(requireVerifiedRole('FOOD_SUPPLIER'));

// ============================================================================
// LISTING CRUD
// ============================================================================

/**
 * POST /listings - Create a new listing
 */
router.post(
  '/',
  validate(createListingSchema.shape.body, 'body'),
  asyncHandler(async (req, res) => {
    const listing = await listingService.createListing(req.user!.userId, req.body);
    res.status(201).json({ success: true, listing });
  })
);

/**
 * GET /listings - Get supplier's own listings
 */
router.get(
  '/',
  validate(listListingsSchema.shape.query, 'query'),
  asyncHandler(async (req, res) => {
    const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
    const pageQuery = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
    const limitQuery = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    
    const result = await listingService.getSupplierListings(req.user!.userId, {
      ...(statusQuery && { status: statusQuery as 'ACTIVE' | 'PAUSED' | 'SOLD_OUT' | 'EXPIRED' | 'CANCELLED' }),
      ...(pageQuery && { page: pageQuery }),
      ...(limitQuery && { limit: limitQuery }),
    });
    res.json({ success: true, ...result });
  })
);

/**
 * GET /listings/claims - Get claims for supplier's listings
 * NOTE: Must be before /:id route to avoid matching
 */
router.get(
  '/claims',
  validate(listClaimsSchema.shape.query, 'query'),
  asyncHandler(async (req, res) => {
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
  })
);

/**
 * POST /listings/claims/:id/verify - Verify pickup OTP
 */
router.post(
  '/claims/:id/verify',
  validate(verifyPickupOtpSchema.shape.params, 'params'),
  validate(verifyPickupOtpSchema.shape.body, 'body'),
  asyncHandler(async (req, res) => {
    const claimId = String(req.params.id);
    if (!claimId) {
      return res.status(400).json({ success: false, message: 'Claim ID required' });
    }
    const claim = await listingService.verifyPickupOtp(
      req.user!.userId,
      claimId,
      req.body.otp
    );
    res.json({ success: true, claim, message: 'Pickup verified successfully' });
  })
);

/**
 * GET /listings/:id - Get a single listing
 */
router.get(
  '/:id',
  validate(getListingSchema.shape.params, 'params'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    const listing = await listingService.getListingById(req.user!.userId, listingId);
    res.json({ success: true, listing });
  })
);

/**
 * PATCH /listings/:id - Update a listing
 */
router.patch(
  '/:id',
  validate(updateListingSchema.shape.params, 'params'),
  validate(updateListingSchema.shape.body, 'body'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    const listing = await listingService.updateListing(req.user!.userId, listingId, req.body);
    res.json({ success: true, listing });
  })
);

/**
 * PATCH /listings/:id/pause - Pause a listing
 */
router.patch(
  '/:id/pause',
  validate(pauseResumeListingSchema.shape.params, 'params'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    const listing = await listingService.pauseListing(req.user!.userId, listingId);
    res.json({ success: true, listing });
  })
);

/**
 * PATCH /listings/:id/resume - Resume a paused listing
 */
router.patch(
  '/:id/resume',
  validate(pauseResumeListingSchema.shape.params, 'params'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    const listing = await listingService.resumeListing(req.user!.userId, listingId);
    res.json({ success: true, listing });
  })
);

/**
 * DELETE /listings/:id - Delete a listing (soft cancel)
 */
router.delete(
  '/:id',
  validate(getListingSchema.shape.params, 'params'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    await listingService.deleteListing(req.user!.userId, listingId);
    res.json({ success: true, message: 'Listing cancelled successfully' });
  })
);

// ============================================================================
// MEDIA UPLOAD ROUTES
// ============================================================================

/**
 * POST /listings/upload/image - Upload listing image
 * Returns the Cloudinary public_id to be used when creating/updating listing
 */
router.post(
  '/upload/image',
  imageUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('No image file provided');
    }

    // Get supplier org for folder path
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
  })
);

/**
 * POST /listings/upload/video - Upload listing video
 * Returns the Cloudinary public_id to be used when creating/updating listing
 */
router.post(
  '/upload/video',
  videoUpload.single('video'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('No video file provided');
    }

    // Get supplier org for folder path
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
  })
);

/**
 * DELETE /listings/upload - Delete uploaded media
 * Used to clean up unused uploads
 * The publicId is passed in the request body since it may contain slashes
 */
router.delete(
  '/upload',
  asyncHandler(async (req, res) => {
    // Get the publicId from the request body
    const publicId = req.body.publicId as string;
    if (!publicId) {
      throw AppError.badRequest('Public ID required');
    }

    // Verify the media belongs to the supplier's org
    const org = await listingService.getSupplierOrg(req.user!.userId);
    if (!publicId.includes(`/listings/${org.id}/`)) {
      throw AppError.forbidden('You can only delete your own media');
    }

    // Determine if it's a video or image based on publicId pattern
    const isVideo = publicId.includes('/vid_');
    await uploadService.deleteListingMedia(publicId, isVideo ? 'video' : 'image');

    res.json({ success: true, message: 'Media deleted successfully' });
  })
);

export default router;
