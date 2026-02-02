import { z } from 'zod';

// ============================================================================
// LISTING SCHEMAS
// ============================================================================

export const claimerTypes = ['NGO', 'INDIVIDUAL', 'BOTH'] as const;
export type ClaimerType = typeof claimerTypes[number];

export const listingStatuses = ['ACTIVE', 'PAUSED', 'SOLD_OUT', 'EXPIRED', 'CANCELLED'] as const;
export type ListingStatusType = typeof listingStatuses[number];

/**
 * Create listing validation
 */
export const createListingSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(100),
    description: z.string().max(500).optional(),
    category: z.string().min(2, 'Category is required').max(50),
    totalStock: z.number().int().min(1, 'Stock must be at least 1'),
    unit: z.string().min(1, 'Unit is required').max(20),
    originalPrice: z.number().min(0, 'Price cannot be negative'),
    subsidizedPrice: z.number().min(0, 'Price cannot be negative'),
    claimerType: z.enum(claimerTypes).default('BOTH'),
    pickupStartAt: z.string().datetime({ message: 'Invalid pickup start time' }),
    pickupEndAt: z.string().datetime({ message: 'Invalid pickup end time' }),
    expiresAt: z.string().datetime({ message: 'Invalid expiry time' }),
    // Media: 1-5 image keys (required at least 1) and optional video key
    imageKeys: z.array(z.string()).min(1, 'At least one image is required').max(5, 'Maximum 5 images allowed'),
    videoKey: z.string().optional(),
  }).refine(data => data.subsidizedPrice <= data.originalPrice, {
    message: 'Subsidized price cannot exceed original price',
    path: ['subsidizedPrice'],
  }).refine(data => new Date(data.pickupEndAt) > new Date(data.pickupStartAt), {
    message: 'Pickup end time must be after start time',
    path: ['pickupEndAt'],
  }).refine(data => new Date(data.expiresAt) > new Date(), {
    message: 'Expiry time must be in the future',
    path: ['expiresAt'],
  }),
});

export type CreateListingInput = z.infer<typeof createListingSchema>['body'];

/**
 * Update listing validation
 */
export const updateListingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(500).optional(),
    category: z.string().min(2).max(50).optional(),
    totalStock: z.number().int().min(1).optional(),
    unit: z.string().min(1).max(20).optional(),
    originalPrice: z.number().min(0).optional(),
    subsidizedPrice: z.number().min(0).optional(),
    claimerType: z.enum(claimerTypes).optional(),
    pickupStartAt: z.string().datetime().optional(),
    pickupEndAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    status: z.enum(['ACTIVE', 'PAUSED']).optional(), // Supplier can only pause/resume
    // Media updates
    imageKeys: z.array(z.string()).min(1).max(5).optional(),
    videoKey: z.string().nullable().optional(), // Can be null to remove video
  }),
});

export type UpdateListingInput = z.infer<typeof updateListingSchema>['body'];

/**
 * Get listing by ID
 */
export const getListingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
});

/**
 * List listings with filtering (for supplier)
 */
export const listListingsSchema = z.object({
  query: z.object({
    status: z.enum(listingStatuses).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

/**
 * Pause/Resume listing
 */
export const pauseResumeListingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
});

// ============================================================================
// CLAIM SCHEMAS
// ============================================================================

export const claimStatuses = ['PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;
export type ClaimStatusType = typeof claimStatuses[number];

/**
 * Create claim validation
 */
export const createClaimSchema = z.object({
  body: z.object({
    listingId: z.string().uuid('Invalid listing ID'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>['body'];

/**
 * Verify pickup OTP
 */
export const verifyPickupOtpSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid claim ID'),
  }),
  body: z.object({
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
  }),
});

/**
 * Cancel claim
 */
export const cancelClaimSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid claim ID'),
  }),
  body: z.object({
    reason: z.string().min(5, 'Please provide a reason').max(200).optional(),
  }),
});

/**
 * List claims (for user or supplier)
 */
export const listClaimsSchema = z.object({
  query: z.object({
    status: z.enum(claimStatuses).optional(),
    listingId: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

// ============================================================================
// PUBLIC HUB SCHEMAS
// ============================================================================

/**
 * Browse listings on public hub
 */
export const browseListingsSchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
    category: z.string().max(50).optional(),
    claimerType: z.enum(['NGO', 'INDIVIDUAL']).optional(),
    supplierId: z.string().uuid().optional(),
    minPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    maxPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
    sortBy: z.enum(['price', 'createdAt', 'expiresAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

export type BrowseListingsQuery = z.infer<typeof browseListingsSchema>['query'];
