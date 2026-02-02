import type { Response } from 'express';
import type { Request } from 'express-serve-static-core';
import type { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminService from '../services/admin.service';
import * as listingService from '../services/listing.service';
import { AppError } from '../utils/AppError';
import type { TokenPayload } from '../types/auth.types';
import { Role, OrgType, KycStatus, ListingStatus } from '../generated/prisma/client';

interface AuthRequest extends Request<ParamsDictionary> {
  user?: TokenPayload;
}

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * GET /admin/dashboard
 * Get admin dashboard statistics
 */
export const getDashboardStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const stats = await adminService.getDashboardStats();
  res.json({ success: true, data: stats });
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /admin/users
 * List users with pagination and filters
 */
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10, role, isRestricted, isEmailVerified, search } = req.query;

  const result = await adminService.getUsers(
    {
      role: role as Role | undefined,
      isRestricted: isRestricted === 'true' ? true : isRestricted === 'false' ? false : undefined,
      isEmailVerified: isEmailVerified === 'true' ? true : isEmailVerified === 'false' ? false : undefined,
      search: typeof search === 'string' ? search : undefined,
    },
    { page: Number(page), limit: Number(limit) }
  );

  res.json({ success: true, data: result });
});

/**
 * GET /admin/users/:id
 * Get single user details
 */
export const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const user = await adminService.getUserById(id);
  res.json({ success: true, data: user });
});

/**
 * PATCH /admin/users/:id
 * Update user details
 */
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, role, isEmailVerified } = req.body;
  
  const user = await adminService.updateUser(id, {
    name: name as string | undefined,
    role: role as Role | undefined,
    isEmailVerified: isEmailVerified as boolean | undefined,
  });
  
  res.json({ success: true, data: user, message: 'User updated' });
});

/**
 * PATCH /admin/users/:id/restrict
 * Restrict a user account
 */
export const restrictUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const adminId = req.user?.userId;
  if (!adminId) throw AppError.unauthorized();

  const id = req.params.id as string;
  const { reason } = req.body;

  if (typeof reason !== 'string' || reason.length < 5) {
    throw AppError.badRequest('Reason must be at least 5 characters');
  }

  const result = await adminService.restrictUser(id, adminId, reason);
  res.json({ success: true, data: result, message: 'User restricted' });
});

/**
 * PATCH /admin/users/:id/unrestrict
 * Unrestrict a user account
 */
export const unrestrictUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await adminService.unrestrictUser(id);
  res.json({ success: true, data: result, message: 'User unrestricted' });
});

/**
 * DELETE /admin/users/:id
 * Delete a user account
 */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await adminService.deleteUser(id);
  res.json({ success: true, data: result, message: 'User deleted' });
});

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

/**
 * GET /admin/organizations
 * List organizations with pagination and filters
 */
export const listOrganizations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10, type, isVerified, isRestricted, search } = req.query;

  const result = await adminService.getOrganizations(
    {
      type: type as OrgType | undefined,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
      isRestricted: isRestricted === 'true' ? true : isRestricted === 'false' ? false : undefined,
      search: typeof search === 'string' ? search : undefined,
    },
    { page: Number(page), limit: Number(limit) }
  );

  res.json({ success: true, data: result });
});

/**
 * GET /admin/organizations/:id
 * Get single organization details
 */
export const getOrganizationById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const org = await adminService.getOrganizationById(id);
  res.json({ success: true, data: org });
});

/**
 * PATCH /admin/organizations/:id/restrict
 * Restrict an organization
 */
export const restrictOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const adminId = req.user?.userId;
  if (!adminId) throw AppError.unauthorized();

  const id = req.params.id as string;
  const { reason } = req.body;

  if (typeof reason !== 'string' || reason.length < 5) {
    throw AppError.badRequest('Reason must be at least 5 characters');
  }

  const result = await adminService.restrictOrganization(id, adminId, reason);
  res.json({ success: true, data: result, message: 'Organization restricted' });
});

/**
 * PATCH /admin/organizations/:id/unrestrict
 * Unrestrict an organization
 */
export const unrestrictOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await adminService.unrestrictOrganization(id);
  res.json({ success: true, data: result, message: 'Organization unrestricted' });
});

/**
 * DELETE /admin/organizations/:id
 * Delete an organization
 */
export const deleteOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await adminService.deleteOrganization(id);
  res.json({ success: true, data: result, message: 'Organization deleted' });
});

// ============================================================================
// KYC MANAGEMENT (Paginated)
// ============================================================================

/**
 * GET /admin/kyc
 * List KYC submissions with pagination and filters
 */
export const listKycPaginated = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10, status, orgType, search } = req.query;

  const result = await adminService.getKycSubmissionsPaginated(
    {
      status: status as KycStatus | undefined,
      orgType: orgType as OrgType | undefined,
      search: typeof search === 'string' ? search : undefined,
    },
    { page: Number(page), limit: Number(limit) }
  );

  res.json({ success: true, data: result });
});

// ============================================================================
// LISTING MANAGEMENT
// ============================================================================

/**
 * GET /admin/listings
 * List all food listings with filters
 */
export const listListings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20, status, supplierId, search } = req.query;

  const result = await listingService.adminGetListings({
    ...(typeof search === 'string' && { search }),
    ...(typeof status === 'string' && { status: status as ListingStatus }),
    ...(typeof supplierId === 'string' && { supplierId }),
    page: Number(page),
    limit: Number(limit),
  });

  res.json({ success: true, data: result });
});

/**
 * GET /admin/listings/:id
 * Get single listing details
 */
export const getListingById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const listing = await listingService.adminGetListingById(id);
  res.json({ success: true, data: listing });
});

/**
 * PATCH /admin/listings/:id/status
 * Update listing status
 */
export const updateListingStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'PAUSED', 'SOLD_OUT', 'EXPIRED', 'CANCELLED'].includes(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const listing = await listingService.adminUpdateListingStatus(id, status as ListingStatus);
  res.json({ success: true, data: listing, message: 'Listing status updated' });
});

/**
 * DELETE /admin/listings/:id
 * Delete a listing
 */
export const deleteListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await listingService.adminDeleteListing(id);
  res.json({ success: true, data: result, message: 'Listing deleted' });
});
