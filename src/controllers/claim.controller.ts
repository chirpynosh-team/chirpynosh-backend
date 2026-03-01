import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as claimService from '../services/claim.service';

/**
 * Claim Controller
 * Handles HTTP requests for user food claim operations
 */

// ============================================================================
// USER CLAIM OPERATIONS
// ============================================================================

/**
 * POST /claims
 * Create a new claim for a listing
 */
export const createClaim = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await claimService.createClaim(req.user!.userId, req.body);

  res.status(201).json({
    success: true,
    claim: result,
    message: 'Claim created successfully. Check your email for pickup OTP.',
  });
});

/**
 * GET /claims
 * Get current user's claims with optional filters
 */
export const getUserClaims = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
  const pageQuery = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
  const limitQuery = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  const result = await claimService.getUserClaims(req.user!.userId, {
    ...(statusQuery && { status: statusQuery as 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' }),
    ...(pageQuery && { page: pageQuery }),
    ...(limitQuery && { limit: limitQuery }),
  });

  res.json({ success: true, ...result });
});

/**
 * GET /claims/:id
 * Get a single claim by ID
 */
export const getClaimById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const claimId = String(req.params.id);
  if (!claimId) {
    res.status(400).json({ success: false, message: 'Claim ID required' });
    return;
  }

  const claim = await claimService.getClaimById(req.user!.userId, claimId);

  res.json({ success: true, claim });
});

/**
 * POST /claims/:id/cancel
 * Cancel an existing claim
 */
export const cancelClaim = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const claimId = String(req.params.id);
  if (!claimId) {
    res.status(400).json({ success: false, message: 'Claim ID required' });
    return;
  }

  const claim = await claimService.cancelClaim(
    req.user!.userId,
    claimId,
    req.body.reason
  );

  res.json({ success: true, claim, message: 'Claim cancelled successfully' });
});

/**
 * POST /claims/:id/resend-otp
 * Resend pickup OTP for a claim
 */
export const resendPickupOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const claimId = String(req.params.id);
  if (!claimId) {
    res.status(400).json({ success: false, message: 'Claim ID required' });
    return;
  }

  const result = await claimService.resendPickupOtp(req.user!.userId, claimId);

  res.json(result);
});
