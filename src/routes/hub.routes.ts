import { Router } from 'express';
import { validate } from '../middleware/validate';
import { browseListingsSchema, getListingSchema } from '../schema/listing.schema';
import * as hubController from '../controllers/hub.controller';

const router = Router();

// ============================================================================
// PUBLIC HUB ROUTES (No authentication required)
// ============================================================================

/** GET /hub/listings - Browse active listings */
router.get(
  '/listings',
  validate(browseListingsSchema.shape.query, 'query'),
  hubController.browseListings
);

/** GET /hub/listings/:id - Get a single listing details */
router.get(
  '/listings/:id',
  validate(getListingSchema.shape.params, 'params'),
  hubController.getPublicListing
);

/** GET /hub/suppliers - Get list of verified suppliers */
router.get('/suppliers', hubController.getSuppliers);

/** GET /hub/ngos - Get list of verified NGOs */
router.get('/ngos', hubController.getNGOs);

/** GET /hub/categories - Get listing categories with counts */
router.get('/categories', hubController.getCategories);

export default router;
