import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { requireOrgOwner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  submitKycSchema,
  uploadDocumentSchema,
} from '../schema/kyc.schema';
import * as kycController from '../controllers/kyc.controller';

const router = Router();

// Configure multer for memory storage (files go to buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allow images and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
    }
  },
});

// ============================================================================
// ORGANIZATION KYC ROUTES
// All routes require authentication and org owner role
// ============================================================================

/**
 * GET /kyc/status
 * Get current organization's KYC status
 * Requires: authenticated, org owner/manager
 */
router.get(
  '/status',
  authenticate,
  kycController.getKycStatus
);

/**
 * POST /kyc/upload/:docType
 * Upload a KYC document
 * Requires: authenticated, org owner
 */
router.post(
  '/upload/:docType',
  authenticate,
  requireOrgOwner(),
  validate(uploadDocumentSchema.shape.params, 'params'),
  upload.single('document'),
  kycController.uploadDocument
);

/**
 * POST /kyc/submit
 * Submit KYC for review
 * Requires: authenticated, org owner
 */
router.post(
  '/submit',
  authenticate,
  requireOrgOwner(),
  validate(submitKycSchema.shape.body, 'body'),
  kycController.submitKyc
);

export default router;
