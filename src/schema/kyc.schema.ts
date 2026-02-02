import { z } from 'zod';

/**
 * Allowed document types for upload
 */
export const kycDocumentTypes = [
  'taxDocument',
  'registrationDoc',
  'businessLicense',
  'idProof',
] as const;

export type KycDocumentType = (typeof kycDocumentTypes)[number];

/**
 * Schema for uploading a document
 */
export const uploadDocumentSchema = z.object({
  params: z.object({
    docType: z.enum(['taxDocument', 'registrationDoc', 'businessLicense', 'idProof'], {
      message: 'docType must be one of: taxDocument, registrationDoc, businessLicense, idProof',
    }),
  }),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

/**
 * Schema for submitting KYC
 */
export const submitKycSchema = z.object({
  body: z.object({
    businessRegisteredName: z.string()
      .min(2, 'Business name must be at least 2 characters')
      .max(200, 'Business name must be less than 200 characters'),
    taxId: z.string()
      .min(5, 'Tax ID must be at least 5 characters')
      .max(50, 'Tax ID must be less than 50 characters'),
    phoneNumber: z.string()
      .min(10, 'Phone number must be at least 10 characters')
      .max(20, 'Phone number must be less than 20 characters')
      .regex(/^[+]?[\d\s-]+$/, 'Invalid phone number format'),
    businessAddress: z.string()
      .min(10, 'Address must be at least 10 characters')
      .max(500, 'Address must be less than 500 characters'),
  }),
});

export type SubmitKycInput = z.infer<typeof submitKycSchema>;

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * KYC status values for filtering
 */
const kycStatusValues = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'] as const;

/**
 * Schema for listing KYC submissions with filters
 */
export const listKycSchema = z.object({
  query: z.object({
    status: z.enum(kycStatusValues).optional(),
    orgType: z.enum(['NGO', 'SUPPLIER']).optional(),
  }),
});

export type ListKycInput = z.infer<typeof listKycSchema>;

/**
 * Schema for getting a single KYC
 */
export const getKycByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid KYC ID'),
  }),
});

export type GetKycByIdInput = z.infer<typeof getKycByIdSchema>;

/**
 * Schema for getting a document URL
 */
export const getDocumentUrlSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid KYC ID'),
    docType: z.enum(['taxDocument', 'registrationDoc', 'businessLicense', 'idProof'], {
      message: 'docType must be one of: taxDocument, registrationDoc, businessLicense, idProof',
    }),
  }),
});

export type GetDocumentUrlInput = z.infer<typeof getDocumentUrlSchema>;

/**
 * Schema for approving KYC
 */
export const approveKycSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid KYC ID'),
  }),
  body: z.object({
    reviewNotes: z.string().max(1000).optional(),
  }),
});

export type ApproveKycInput = z.infer<typeof approveKycSchema>;

/**
 * Schema for rejecting KYC
 */
export const rejectKycSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid KYC ID'),
  }),
  body: z.object({
    rejectionReason: z.string()
      .min(10, 'Rejection reason must be at least 10 characters')
      .max(1000, 'Rejection reason must be less than 1000 characters'),
    reviewNotes: z.string().max(1000).optional(),
  }),
});

export type RejectKycInput = z.infer<typeof rejectKycSchema>;
