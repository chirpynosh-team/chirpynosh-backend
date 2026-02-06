import { Router } from 'express';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as listingService from '../services/listing.service';
import { browseListingsSchema, getListingSchema } from '../schema/listing.schema';

const router = Router();

// ============================================================================
// PUBLIC HUB ROUTES (No authentication required)
// ============================================================================

/**
 * GET /hub/listings - Browse active listings
 */
router.get(
  '/listings',
  validate(browseListingsSchema.shape.query, 'query'),
  asyncHandler(async (req, res) => {
    const result = await listingService.browseListings(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  })
);

/**
 * GET /hub/listings/:id - Get a single listing details
 */
router.get(
  '/listings/:id',
  validate(getListingSchema.shape.params, 'params'),
  asyncHandler(async (req, res) => {
    const listingId = String(req.params.id);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Listing ID required' });
    }
    const listing = await listingService.getPublicListingById(listingId);
    res.json({ success: true, listing });
  })
);

/**
 * GET /hub/suppliers - Get list of verified suppliers
 */
router.get(
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const suppliers = await listingService.getSuppliers();
    res.json({ success: true, suppliers });
  })
);

/**
 * GET /hub/ngos - Get list of verified NGOs
 */
router.get(
  '/ngos',
  asyncHandler(async (_req, res) => {
    const ngos = await listingService.getNGOs();
    res.json({ success: true, ngos });
  })
);

/**
 * GET /hub/categories - Get listing categories with counts
 */
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await listingService.getCategories();
    res.json({ success: true, categories });
  })
);

export default router;
