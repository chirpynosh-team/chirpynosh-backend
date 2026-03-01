import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as listingService from '../services/listing.service';

/**
 * Hub Controller
 * Handles HTTP requests for public hub operations (no auth required)
 */

// ============================================================================
// PUBLIC LISTING BROWSING
// ============================================================================

/**
 * GET /hub/listings
 * Browse active listings with filters and pagination
 */
export const browseListings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await listingService.browseListings(req.query as Record<string, string>);

  res.json({ success: true, ...result });
});

/**
 * GET /hub/listings/:id
 * Get a single listing's public details
 */
export const getPublicListing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const listingId = String(req.params.id);
  if (!listingId) {
    res.status(400).json({ success: false, message: 'Listing ID required' });
    return;
  }

  const listing = await listingService.getPublicListingById(listingId);

  res.json({ success: true, listing });
});

// ============================================================================
// PUBLIC DIRECTORY
// ============================================================================

/**
 * GET /hub/suppliers
 * Get list of verified suppliers
 */
export const getSuppliers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const suppliers = await listingService.getSuppliers();

  res.json({ success: true, suppliers });
});

/**
 * GET /hub/ngos
 * Get list of verified NGOs
 */
export const getNGOs = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const ngos = await listingService.getNGOs();

  res.json({ success: true, ngos });
});

/**
 * GET /hub/categories
 * Get listing categories with counts
 */
export const getCategories = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const categories = await listingService.getCategories();

  res.json({ success: true, categories });
});
