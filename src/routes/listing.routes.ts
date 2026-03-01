import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireVerifiedRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createListingSchema,
  updateListingSchema,
  getListingSchema,
  listListingsSchema,
  pauseResumeListingSchema,
  listClaimsSchema,
  verifyPickupOtpSchema,
} from '../schema/listing.schema';
import * as listingController from '../controllers/listing.controller';

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

/** POST /listings - Create a new listing */
router.post(
  '/',
  validate(createListingSchema.shape.body, 'body'),
  listingController.createListing
);

/** GET /listings - Get supplier's own listings */
router.get(
  '/',
  validate(listListingsSchema.shape.query, 'query'),
  listingController.getSupplierListings
);

/** GET /listings/claims - Get claims for supplier's listings (must be before /:id) */
router.get(
  '/claims',
  validate(listClaimsSchema.shape.query, 'query'),
  listingController.getSupplierClaims
);

/** POST /listings/claims/:id/verify - Verify pickup OTP */
router.post(
  '/claims/:id/verify',
  validate(verifyPickupOtpSchema.shape.params, 'params'),
  validate(verifyPickupOtpSchema.shape.body, 'body'),
  listingController.verifyPickupOtp
);

/** GET /listings/:id - Get a single listing */
router.get(
  '/:id',
  validate(getListingSchema.shape.params, 'params'),
  listingController.getListingById
);

/** PATCH /listings/:id - Update a listing */
router.patch(
  '/:id',
  validate(updateListingSchema.shape.params, 'params'),
  validate(updateListingSchema.shape.body, 'body'),
  listingController.updateListing
);

/** PATCH /listings/:id/pause - Pause a listing */
router.patch(
  '/:id/pause',
  validate(pauseResumeListingSchema.shape.params, 'params'),
  listingController.pauseListing
);

/** PATCH /listings/:id/resume - Resume a paused listing */
router.patch(
  '/:id/resume',
  validate(pauseResumeListingSchema.shape.params, 'params'),
  listingController.resumeListing
);

/** DELETE /listings/:id - Delete a listing (soft cancel) */
router.delete(
  '/:id',
  validate(getListingSchema.shape.params, 'params'),
  listingController.deleteListing
);

// ============================================================================
// MEDIA UPLOAD ROUTES
// ============================================================================

/** POST /listings/upload/image - Upload listing image */
router.post(
  '/upload/image',
  imageUpload.single('image'),
  listingController.uploadImage
);

/** POST /listings/upload/video - Upload listing video */
router.post(
  '/upload/video',
  videoUpload.single('video'),
  listingController.uploadVideo
);

/** DELETE /listings/upload - Delete uploaded media */
router.delete(
  '/upload',
  listingController.deleteMedia
);

export default router;
