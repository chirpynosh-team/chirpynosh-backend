import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/authorize';
import { validate } from '../middleware/validate';

// KYC schemas (existing)
import {
  getKycByIdSchema,
  getDocumentUrlSchema,
  approveKycSchema,
  rejectKycSchema,
} from '../schema/kyc.schema';

// Admin schemas (new)
import {
  listUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  restrictUserSchema,
  userIdParamSchema,
  listOrgsSchema,
  getOrgByIdSchema,
  restrictOrgSchema,
  orgIdParamSchema,
  listKycPaginatedSchema,
} from '../schema/admin.schema';

// Controllers
import * as kycController from '../controllers/kyc.controller';
import * as adminController from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(requireAdmin());

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * GET /admin/dashboard
 * Get admin dashboard statistics
 */
router.get('/dashboard', adminController.getDashboardStats);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /admin/users
 * List users with pagination and filters
 */
router.get(
  '/users',
  validate(listUsersSchema.shape.query, 'query'),
  adminController.listUsers
);

/**
 * GET /admin/users/:id
 * Get single user details
 */
router.get(
  '/users/:id',
  validate(getUserByIdSchema.shape.params, 'params'),
  adminController.getUserById
);

/**
 * PATCH /admin/users/:id
 * Update user details
 */
router.patch(
  '/users/:id',
  validate(updateUserSchema.shape.params, 'params'),
  validate(updateUserSchema.shape.body, 'body'),
  adminController.updateUser
);

/**
 * PATCH /admin/users/:id/restrict
 * Restrict a user account
 */
router.patch(
  '/users/:id/restrict',
  validate(restrictUserSchema.shape.params, 'params'),
  validate(restrictUserSchema.shape.body, 'body'),
  adminController.restrictUser
);

/**
 * PATCH /admin/users/:id/unrestrict
 * Unrestrict a user account
 */
router.patch(
  '/users/:id/unrestrict',
  validate(userIdParamSchema.shape.params, 'params'),
  adminController.unrestrictUser
);

/**
 * DELETE /admin/users/:id
 * Delete a user account
 */
router.delete(
  '/users/:id',
  validate(userIdParamSchema.shape.params, 'params'),
  adminController.deleteUser
);

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

/**
 * GET /admin/organizations
 * List organizations with pagination and filters
 */
router.get(
  '/organizations',
  validate(listOrgsSchema.shape.query, 'query'),
  adminController.listOrganizations
);

/**
 * GET /admin/organizations/:id
 * Get single organization details
 */
router.get(
  '/organizations/:id',
  validate(getOrgByIdSchema.shape.params, 'params'),
  adminController.getOrganizationById
);

/**
 * PATCH /admin/organizations/:id/restrict
 * Restrict an organization
 */
router.patch(
  '/organizations/:id/restrict',
  validate(restrictOrgSchema.shape.params, 'params'),
  validate(restrictOrgSchema.shape.body, 'body'),
  adminController.restrictOrganization
);

/**
 * PATCH /admin/organizations/:id/unrestrict
 * Unrestrict an organization
 */
router.patch(
  '/organizations/:id/unrestrict',
  validate(orgIdParamSchema.shape.params, 'params'),
  adminController.unrestrictOrganization
);

/**
 * DELETE /admin/organizations/:id
 * Delete an organization
 */
router.delete(
  '/organizations/:id',
  validate(orgIdParamSchema.shape.params, 'params'),
  adminController.deleteOrganization
);

// ============================================================================
// KYC MANAGEMENT
// ============================================================================

/**
 * GET /admin/kyc
 * List KYC submissions with pagination and filters
 */
router.get(
  '/kyc',
  validate(listKycPaginatedSchema.shape.query, 'query'),
  adminController.listKycPaginated
);

/**
 * GET /admin/kyc/:id
 * Get single KYC submission details
 */
router.get(
  '/kyc/:id',
  validate(getKycByIdSchema.shape.params, 'params'),
  kycController.getKycById
);

/**
 * GET /admin/kyc/:id/document/:docType
 * Get signed URL for a KYC document (60 second expiry)
 */
router.get(
  '/kyc/:id/document/:docType',
  validate(getDocumentUrlSchema.shape.params, 'params'),
  kycController.getDocumentUrl
);

/**
 * PATCH /admin/kyc/:id/approve
 * Approve a KYC submission
 */
router.patch(
  '/kyc/:id/approve',
  validate(approveKycSchema.shape.params, 'params'),
  validate(approveKycSchema.shape.body, 'body'),
  kycController.approveKyc
);

/**
 * PATCH /admin/kyc/:id/reject
 * Reject a KYC submission
 */
router.patch(
  '/kyc/:id/reject',
  validate(rejectKycSchema.shape.params, 'params'),
  validate(rejectKycSchema.shape.body, 'body'),
  kycController.rejectKyc
);

// ============================================================================
// LISTING MANAGEMENT
// ============================================================================

/**
 * GET /admin/listings
 * List all food listings with filters
 */
router.get('/listings', adminController.listListings);

/**
 * GET /admin/listings/:id
 * Get single listing details
 */
router.get('/listings/:id', adminController.getListingById);

/**
 * PATCH /admin/listings/:id/status
 * Update listing status
 */
router.patch('/listings/:id/status', adminController.updateListingStatus);

/**
 * DELETE /admin/listings/:id
 * Delete a listing
 */
router.delete('/listings/:id', adminController.deleteListing);

export default router;
