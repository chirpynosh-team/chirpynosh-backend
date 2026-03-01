import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  createClaimSchema,
  listClaimsSchema,
  getListingSchema,
  cancelClaimSchema,
} from '../schema/listing.schema';
import * as claimController from '../controllers/claim.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// USER CLAIM ROUTES
// ============================================================================

/** POST /claims - Create a new claim */
router.post(
  '/',
  validate(createClaimSchema.shape.body, 'body'),
  claimController.createClaim
);

/** GET /claims - Get user's claims */
router.get(
  '/',
  validate(listClaimsSchema.shape.query, 'query'),
  claimController.getUserClaims
);

/** GET /claims/:id - Get a single claim */
router.get(
  '/:id',
  validate(getListingSchema.shape.params, 'params'),
  claimController.getClaimById
);

/** POST /claims/:id/cancel - Cancel a claim */
router.post(
  '/:id/cancel',
  validate(cancelClaimSchema.shape.params, 'params'),
  validate(cancelClaimSchema.shape.body, 'body'),
  claimController.cancelClaim
);

/** POST /claims/:id/resend-otp - Resend pickup OTP */
router.post(
  '/:id/resend-otp',
  validate(getListingSchema.shape.params, 'params'),
  claimController.resendPickupOtp
);

export default router;
