import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as claimService from '../services/claim.service';
import {
  createClaimSchema,
  listClaimsSchema,
  getListingSchema,
  cancelClaimSchema,
} from '../schema/listing.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// USER CLAIM ROUTES
// ============================================================================

/**
 * POST /claims - Create a new claim
 */
router.post(
  '/',
  validate(createClaimSchema.shape.body, 'body'),
  asyncHandler(async (req, res) => {
    const result = await claimService.createClaim(req.user!.userId, req.body);
    res.status(201).json({ 
      success: true, 
      claim: result,
      message: 'Claim created successfully. Check your email for pickup OTP.' 
    });
  })
);

/**
 * GET /claims - Get user's claims
 */
router.get(
  '/',
  validate(listClaimsSchema.shape.query, 'query'),
  asyncHandler(async (req, res) => {
    const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
    const pageQuery = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
    const limitQuery = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    
    const result = await claimService.getUserClaims(req.user!.userId, {
      ...(statusQuery && { status: statusQuery as 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' }),
      ...(pageQuery && { page: pageQuery }),
      ...(limitQuery && { limit: limitQuery }),
    });
    res.json({ success: true, ...result });
  })
);

/**
 * GET /claims/:id - Get a single claim
 */
router.get(
  '/:id',
  validate(getListingSchema.shape.params, 'params'), // Reusing schema for UUID validation
  asyncHandler(async (req, res) => {
    const claimId = String(req.params.id);
    if (!claimId) {
      return res.status(400).json({ success: false, message: 'Claim ID required' });
    }
    const claim = await claimService.getClaimById(req.user!.userId, claimId);
    res.json({ success: true, claim });
  })
);

/**
 * POST /claims/:id/cancel - Cancel a claim
 */
router.post(
  '/:id/cancel',
  validate(cancelClaimSchema.shape.params, 'params'),
  validate(cancelClaimSchema.shape.body, 'body'),
  asyncHandler(async (req, res) => {
    const claimId = String(req.params.id);
    if (!claimId) {
      return res.status(400).json({ success: false, message: 'Claim ID required' });
    }
    const claim = await claimService.cancelClaim(
      req.user!.userId,
      claimId,
      req.body.reason
    );
    res.json({ success: true, claim, message: 'Claim cancelled successfully' });
  })
);

/**
 * POST /claims/:id/resend-otp - Resend pickup OTP
 */
router.post(
  '/:id/resend-otp',
  validate(getListingSchema.shape.params, 'params'), // Reusing schema for UUID validation
  asyncHandler(async (req, res) => {
    const claimId = String(req.params.id);
    if (!claimId) {
      return res.status(400).json({ success: false, message: 'Claim ID required' });
    }
    const result = await claimService.resendPickupOtp(req.user!.userId, claimId);
    res.json(result);
  })
);

export default router;
