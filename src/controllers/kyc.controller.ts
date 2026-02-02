import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as kycService from '../services/kyc.service';
import type { 
  SubmitKycInput, 
  ListKycInput, 
  GetKycByIdInput,
  GetDocumentUrlInput,
  ApproveKycInput, 
  RejectKycInput,
  KycDocumentType
} from '../schema/kyc.schema';
import { AppError } from '../utils/AppError';
import type { TokenPayload } from '../types/auth.types';

/**
 * Extended Request with authenticated user
 */
interface AuthRequest extends Request {
  user?: TokenPayload;
}

// ============================================================================
// ORGANIZATION ENDPOINTS
// ============================================================================

/**
 * GET /kyc/status
 * Get current organization's KYC status
 */
export const getKycStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw AppError.unauthorized();

  const status = await kycService.getKycStatus(userId);

  res.json({
    success: true,
    data: status,
  });
});

/**
 * POST /kyc/upload/:docType
 * Upload a KYC document
 */
export const uploadDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw AppError.unauthorized();

  const docType = req.params.docType as KycDocumentType;

  // File should be attached via multer or similar
  if (!req.file) {
    throw AppError.badRequest('No file uploaded');
  }

  // Extract extension
  const originalName = req.file.originalname;
  const extension = originalName.includes('.') 
    ? originalName.substring(originalName.lastIndexOf('.'))
    : undefined;

  const result = await kycService.uploadDocument(userId, docType, req.file.buffer, extension);

  res.json({
    success: true,
    data: result,
    message: 'Document uploaded successfully',
  });
});

/**
 * POST /kyc/submit
 * Submit KYC for review
 */
export const submitKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw AppError.unauthorized();

  const data = req.body as SubmitKycInput['body'];

  const result = await kycService.submitKyc(userId, data);

  res.json({
    success: true,
    data: result,
    message: 'KYC submitted successfully for review',
  });
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /admin/kyc
 * List all KYC submissions with optional filters
 */
export const listKycSubmissions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, orgType } = req.query as ListKycInput['query'];

  const submissions = await kycService.getAllKycSubmissions({
    status: status as never,
    orgType: orgType,
  });

  res.json({
    success: true,
    data: submissions,
    count: submissions.length,
  });
});

/**
 * GET /admin/kyc/:id
 * Get single KYC submission details
 */
export const getKycById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params as GetKycByIdInput['params'];

  const kyc = await kycService.getKycById(id);

  res.json({
    success: true,
    data: kyc,
  });
});

/**
 * GET /admin/kyc/:id/document/:docType
 * Get signed URL for a KYC document (30 second expiry)
 */
export const getDocumentUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, docType } = req.params as GetDocumentUrlInput['params'];
  const adminEmail = req.user?.email || 'unknown';

  const result = await kycService.getDocumentUrl(id, docType, adminEmail);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /admin/kyc/:id/approve
 * Approve a KYC submission
 */
export const approveKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params as ApproveKycInput['params'];
  const { reviewNotes } = req.body as ApproveKycInput['body'];
  const adminId = req.user?.userId;

  if (!adminId) throw AppError.unauthorized();

  const result = await kycService.approveKyc(id, adminId, reviewNotes);

  res.json({
    success: true,
    data: result,
    message: 'KYC approved successfully',
  });
});

/**
 * PATCH /admin/kyc/:id/reject
 * Reject a KYC submission
 */
export const rejectKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params as RejectKycInput['params'];
  const { rejectionReason, reviewNotes } = req.body as RejectKycInput['body'];
  const adminId = req.user?.userId;

  if (!adminId) throw AppError.unauthorized();

  const result = await kycService.rejectKyc(id, adminId, rejectionReason, reviewNotes);

  res.json({
    success: true,
    data: result,
    message: 'KYC rejected',
  });
});
