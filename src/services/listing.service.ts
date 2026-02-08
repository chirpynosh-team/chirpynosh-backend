import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { ListingStatus, ClaimerType, ClaimStatus } from '../generated/prisma/client';
import type { CreateListingInput, UpdateListingInput, BrowseListingsQuery } from '../schema/listing.schema';
import crypto from 'crypto';

// ============================================================================
// SUPPLIER LISTING FUNCTIONS
// ============================================================================

/**
 * Get user's supplier organization (must be verified)
 */
export const getSupplierOrg = async (userId: string) => {
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId,
      org: {
        is: {
          type: 'SUPPLIER',
          isVerified: true,
          isRestricted: false,
        },
      },
    },
    include: {
      org: true,
    },
  });

  if (!membership) {
    throw AppError.forbidden('You must be a verified food supplier to manage listings');
  }

  return membership.org;
};

/**
 * Create a new food listing
 */
export const createListing = async (userId: string, data: CreateListingInput) => {
  const org = await getSupplierOrg(userId);

  const listing = await prisma.foodListing.create({
    data: {
      orgId: org.id,
      title: data.title,
      description: data.description ?? null,
      category: data.category,
      totalStock: data.totalStock,
      remainingStock: data.totalStock, // Initially same as total
      unit: data.unit,
      originalPrice: data.originalPrice,
      subsidizedPrice: data.subsidizedPrice,
      claimerType: data.claimerType as ClaimerType,
      pickupStartAt: new Date(data.pickupStartAt),
      pickupEndAt: new Date(data.pickupEndAt),
      expiresAt: new Date(data.expiresAt),
      status: ListingStatus.ACTIVE,
      imageKeys: data.imageKeys,
      videoKey: data.videoKey ?? null,
    },
    include: {
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  return listing;
};

/**
 * Get supplier's own listings
 */
export const getSupplierListings = async (
  userId: string,
  options: { status?: ListingStatus; page?: number; limit?: number } = {}
) => {
  const org = await getSupplierOrg(userId);
  const { status, page = 1, limit = 20 } = options;

  const where = {
    orgId: org.id,
    ...(status && { status }),
  };

  const [listings, total] = await Promise.all([
    prisma.foodListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { claims: true } },
      },
    }),
    prisma.foodListing.count({ where }),
  ]);

  return {
    listings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single listing by ID (for supplier)
 */
export const getListingById = async (userId: string, listingId: string) => {
  const org = await getSupplierOrg(userId);

  const listing = await prisma.foodListing.findFirst({
    where: {
      id: listingId,
      orgId: org.id,
    },
    include: {
      organization: { select: { id: true, name: true } },
      claims: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          claimer: { select: { id: true, name: true, email: true } },
          claimerOrg: { select: { id: true, name: true } },
        },
      },
      _count: { select: { claims: true } },
    },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  return listing;
};

/**
 * Update a listing
 */
export const updateListing = async (userId: string, listingId: string, data: UpdateListingInput) => {
  const org = await getSupplierOrg(userId);

  // Check ownership
  const existing = await prisma.foodListing.findFirst({
    where: { id: listingId, orgId: org.id },
  });

  if (!existing) {
    throw AppError.notFound('Listing not found');
  }

  // Can't update sold out or cancelled listings
  if (existing.status === ListingStatus.SOLD_OUT || existing.status === ListingStatus.CANCELLED) {
    throw AppError.badRequest(`Cannot update a ${existing.status.toLowerCase()} listing`);
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  
  if (data.title) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category) updateData.category = data.category;
  if (data.unit) updateData.unit = data.unit;
  if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
  if (data.subsidizedPrice !== undefined) updateData.subsidizedPrice = data.subsidizedPrice;
  if (data.claimerType) updateData.claimerType = data.claimerType;
  if (data.pickupStartAt) updateData.pickupStartAt = new Date(data.pickupStartAt);
  if (data.pickupEndAt) updateData.pickupEndAt = new Date(data.pickupEndAt);
  if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);
  if (data.status) updateData.status = data.status;
  // Media fields
  if (data.imageKeys) updateData.imageKeys = data.imageKeys;
  if (data.videoKey !== undefined) updateData.videoKey = data.videoKey;

  // Handle stock increase (can only increase, not decrease below remaining)
  if (data.totalStock !== undefined) {
    if (data.totalStock < existing.remainingStock) {
      throw AppError.badRequest('Cannot reduce total stock below remaining stock');
    }
    updateData.totalStock = data.totalStock;
    // Adjust remaining stock proportionally
    const stockDiff = data.totalStock - existing.totalStock;
    if (stockDiff > 0) {
      updateData.remainingStock = existing.remainingStock + stockDiff;
    }
  }

  const updated = await prisma.foodListing.update({
    where: { id: listingId },
    data: updateData,
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  return updated;
};

/**
 * Pause a listing
 */
export const pauseListing = async (userId: string, listingId: string) => {
  const org = await getSupplierOrg(userId);

  const listing = await prisma.foodListing.findFirst({
    where: { id: listingId, orgId: org.id },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  if (listing.status !== ListingStatus.ACTIVE) {
    throw AppError.badRequest('Only active listings can be paused');
  }

  return prisma.foodListing.update({
    where: { id: listingId },
    data: { status: ListingStatus.PAUSED },
  });
};

/**
 * Resume a paused listing
 */
export const resumeListing = async (userId: string, listingId: string) => {
  const org = await getSupplierOrg(userId);

  const listing = await prisma.foodListing.findFirst({
    where: { id: listingId, orgId: org.id },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  if (listing.status !== ListingStatus.PAUSED) {
    throw AppError.badRequest('Only paused listings can be resumed');
  }

  // Check if expired
  if (new Date(listing.expiresAt) < new Date()) {
    throw AppError.badRequest('Cannot resume an expired listing');
  }

  return prisma.foodListing.update({
    where: { id: listingId },
    data: { status: ListingStatus.ACTIVE },
  });
};

/**
 * Delete a listing (soft cancel)
 */
export const deleteListing = async (userId: string, listingId: string) => {
  const org = await getSupplierOrg(userId);

  const listing = await prisma.foodListing.findFirst({
    where: { id: listingId, orgId: org.id },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  // Check for pending claims
  const pendingClaims = await prisma.foodClaim.count({
    where: { listingId, status: ClaimStatus.PENDING },
  });

  if (pendingClaims > 0) {
    throw AppError.badRequest(`Cannot delete listing with ${pendingClaims} pending claims`);
  }

  return prisma.foodListing.update({
    where: { id: listingId },
    data: { status: ListingStatus.CANCELLED },
  });
};

// ============================================================================
// SUPPLIER CLAIMS FUNCTIONS
// ============================================================================

/**
 * Get claims for supplier's listings
 */
export const getSupplierClaims = async (
  userId: string,
  options: { status?: ClaimStatus; listingId?: string; page?: number; limit?: number } = {}
) => {
  const org = await getSupplierOrg(userId);
  const { status, listingId, page = 1, limit = 20 } = options;

  const where = {
    listing: { is: { orgId: org.id } },
    ...(status && { status }),
    ...(listingId && { listingId }),
  };

  const [claims, total] = await Promise.all([
    prisma.foodClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        listing: { select: { id: true, title: true, unit: true } },
        claimer: { select: { id: true, name: true, email: true } },
        claimerOrg: { select: { id: true, name: true } },
      },
    }),
    prisma.foodClaim.count({ where }),
  ]);

  return {
    claims,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Verify pickup OTP (supplier verifies claimer's OTP)
 */
export const verifyPickupOtp = async (userId: string, claimId: string, otp: string) => {
  const org = await getSupplierOrg(userId);

  const claim = await prisma.foodClaim.findFirst({
    where: {
      id: claimId,
      listing: { is: { orgId: org.id } },
    },
    include: {
      listing: { select: { id: true, title: true } },
      claimer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!claim) {
    throw AppError.notFound('Claim not found');
  }

  if (claim.status !== ClaimStatus.PENDING) {
    throw AppError.badRequest(`Cannot verify OTP for ${claim.status.toLowerCase()} claim`);
  }

  // Hash OTP and compare
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (otpHash !== claim.pickupOtpHash) {
    throw AppError.badRequest('Invalid OTP');
  }

  // Mark as completed
  const updated = await prisma.foodClaim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.COMPLETED,
      pickedUpAt: new Date(),
    },
    include: {
      listing: { select: { id: true, title: true } },
      claimer: { select: { id: true, name: true, email: true } },
    },
  });

  return updated;
};

// ============================================================================
// PUBLIC HUB FUNCTIONS
// ============================================================================

/**
 * Browse active listings on public hub
 */
export const browseListings = async (query: BrowseListingsQuery) => {
  const {
    search,
    category,
    claimerType,
    supplierId,
    minPrice,
    maxPrice,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = query;

  // Ensure page and limit are numbers (they come as strings from query params)
  const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  const minPriceNum = typeof minPrice === 'string' ? parseFloat(minPrice) : minPrice;
  const maxPriceNum = typeof maxPrice === 'string' ? parseFloat(maxPrice) : maxPrice;

  const where: Record<string, unknown> = {
    status: ListingStatus.ACTIVE,
    expiresAt: { gt: new Date() }, // Not expired
    remainingStock: { gt: 0 }, // Has stock
    organization: {
      is: {
        isVerified: true,
        isRestricted: false,
      },
    },
  };

  // Search by title
  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  // Filter by category
  if (category) {
    where.category = { equals: category, mode: 'insensitive' };
  }

  // Filter by claimer type (NGO can see BOTH + NGO, INDIVIDUAL can see BOTH + INDIVIDUAL)
  if (claimerType) {
    where.claimerType = { in: [claimerType, 'BOTH'] };
  }

  // Filter by supplier
  if (supplierId) {
    where.orgId = supplierId;
  }

  // Price filter (on subsidized price)
  if (minPriceNum !== undefined || maxPriceNum !== undefined) {
    where.subsidizedPrice = {};
    if (minPriceNum !== undefined) (where.subsidizedPrice as Record<string, number>).gte = minPriceNum;
    if (maxPriceNum !== undefined) (where.subsidizedPrice as Record<string, number>).lte = maxPriceNum;
  }

  // Sorting
  const orderBy: Record<string, string> = {};
  if (sortBy === 'price') {
    orderBy.subsidizedPrice = sortOrder;
  } else if (sortBy === 'expiresAt') {
    orderBy.expiresAt = sortOrder;
  } else {
    orderBy.createdAt = sortOrder;
  }

  const [listings, total] = await Promise.all([
    prisma.foodListing.findMany({
      where,
      orderBy,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.foodListing.count({ where }),
  ]);

  return {
    listings,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get a single listing for public view
 */
export const getPublicListingById = async (listingId: string) => {
  const listing = await prisma.foodListing.findFirst({
    where: {
      id: listingId,
      status: ListingStatus.ACTIVE,
      organization: {
        is: {
          isVerified: true,
          isRestricted: false,
        },
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found or no longer available');
  }

  return listing;
};

/**
 * Get list of verified suppliers
 */
export const getSuppliers = async () => {
  const suppliers = await prisma.organization.findMany({
    where: {
      type: 'SUPPLIER',
      isVerified: true,
      isRestricted: false,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          listings: {
            where: { status: ListingStatus.ACTIVE },
          },
        },
      },
    },
  });

  return suppliers;
};

/**
 * Get list of verified NGOs
 */
export const getNGOs = async () => {
  const ngos = await prisma.organization.findMany({
    where: {
      type: 'NGO',
      isVerified: true,
      isRestricted: false,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          claimsAsOrg: true,
        },
      },
    },
  });

  return ngos.map((ngo) => ({
    id: ngo.id,
    name: ngo.name,
    claimCount: ngo._count.claimsAsOrg,
  }));
};

/**
 * Get listing categories with counts
 */
export const getCategories = async () => {
  const categories = await prisma.foodListing.groupBy({
    by: ['category'],
    where: {
      status: ListingStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    _count: { category: true },
  });

  return categories.map((c: { category: string; _count: { category: number } }) => ({
    name: c.category,
    count: c._count.category,
  }));
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

export interface AdminListingsQuery {
  search?: string;
  status?: ListingStatus;
  supplierId?: string;
  page?: number;
  limit?: number;
}

/**
 * Admin: Get all listings with filters
 */
export const adminGetListings = async (query: AdminListingsQuery) => {
  const { search, status, supplierId, page = 1, limit = 20 } = query;

  // Ensure page and limit are numbers (they may come as strings from query params)
  const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (status) {
    where.status = status;
  }
  if (supplierId) {
    where.orgId = supplierId;
  }

  const [listings, total] = await Promise.all([
    prisma.foodListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { claims: true } },
      },
    }),
    prisma.foodListing.count({ where }),
  ]);

  return {
    listings,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Admin: Get listing by ID
 */
export const adminGetListingById = async (listingId: string) => {
  const listing = await prisma.foodListing.findUnique({
    where: { id: listingId },
    include: {
      organization: { select: { id: true, name: true } },
      claims: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          claimer: { select: { id: true, name: true, email: true } },
          claimerOrg: { select: { id: true, name: true } },
        },
      },
      _count: { select: { claims: true } },
    },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  return listing;
};

/**
 * Admin: Update listing status
 */
export const adminUpdateListingStatus = async (listingId: string, status: ListingStatus) => {
  const listing = await prisma.foodListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  return prisma.foodListing.update({
    where: { id: listingId },
    data: { status },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });
};

/**
 * Admin: Delete listing (permanent)
 */
export const adminDeleteListing = async (listingId: string) => {
  const listing = await prisma.foodListing.findUnique({
    where: { id: listingId },
    include: { _count: { select: { claims: true } } },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found');
  }

  // Don't delete if there are claims
  if (listing._count.claims > 0) {
    throw AppError.badRequest(
      `Cannot delete listing with ${listing._count.claims} claims. Cancel the listing instead.`
    );
  }

  await prisma.foodListing.delete({
    where: { id: listingId },
  });

  return { success: true };
};
