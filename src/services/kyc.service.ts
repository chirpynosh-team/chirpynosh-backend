import { prisma } from '../config/prisma';
import { KycStatus, OrgRole } from '../generated/prisma/client';
import { AppError } from '../utils/AppError';
import { 
  uploadKycDocument, 
  generateSignedUrl, 
  generateSignedRawUrl,
  isImageDocument,
  deleteDocument 
} from './upload.service';
import type { KycDocumentType } from './upload.service';

/**
 * KYC submission data from frontend
 */
export interface KycSubmitData {
  businessRegisteredName: string;
  taxId: string;
  phoneNumber: string;
  businessAddress: string;
}

/**
 * Get user's organization (must be OWNER to manage KYC)
 */
export const getUserOrganization = async (userId: string) => {
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId,
      orgRole: OrgRole.OWNER,
    },
    include: {
      org: {
        include: {
          kyc: true,
        },
      },
    },
  });

  if (!membership) {
    throw AppError.forbidden('You must be an organization owner to manage KYC');
  }

  return membership.org;
};

/**
 * Get or create KYC submission for an organization
 */
export const getOrCreateKyc = async (orgId: string) => {
  let kyc = await prisma.kycSubmission.findUnique({
    where: { orgId },
  });

  if (!kyc) {
    kyc = await prisma.kycSubmission.create({
      data: {
        orgId,
        status: KycStatus.NOT_SUBMITTED,
      },
    });
  }

  return kyc;
};

/**
 * Get KYC status for organization
 */
export const getKycStatus = async (userId: string) => {
  const org = await getUserOrganization(userId);
  const kyc = await getOrCreateKyc(org.id);

  return {
    status: kyc.status,
    businessRegisteredName: kyc.businessRegisteredName,
    taxId: kyc.taxId,
    phoneNumber: kyc.phoneNumber,
    businessAddress: kyc.businessAddress,
    hasDocuments: {
      taxDocument: !!kyc.taxDocumentKey,
      registrationDoc: !!kyc.registrationDocKey,
      businessLicense: !!kyc.businessLicenseKey,
      idProof: !!kyc.idProofKey,
    },
    submittedAt: kyc.submittedAt,
    reviewedAt: kyc.reviewedAt,
    rejectionReason: kyc.rejectionReason,
  };
};

/**
 * Upload a KYC document
 */
export const uploadDocument = async (
  userId: string,
  docType: KycDocumentType,
  fileBuffer: Buffer,
  extension?: string
) => {
  const org = await getUserOrganization(userId);
  const kyc = await getOrCreateKyc(org.id);

  // Can only upload if NOT_SUBMITTED or REJECTED
  if (kyc.status !== KycStatus.NOT_SUBMITTED && kyc.status !== KycStatus.REJECTED) {
    throw AppError.badRequest('Cannot upload documents while KYC is pending or approved');
  }

  // Map docType to database field
  const docKeyField = `${docType}Key` as const;
  
  // If replacing, delete old document
  const oldKey = kyc[docKeyField as keyof typeof kyc] as string | null;
  if (oldKey) {
    await deleteDocument(oldKey);
  }

  // Upload new document
  const result = await uploadKycDocument(fileBuffer, org.id, docType, extension);

  // Update KYC record
  await prisma.kycSubmission.update({
    where: { id: kyc.id },
    data: {
      [docKeyField]: result.publicId,
    },
  });

  return { success: true, docType };
};

/**
 * Submit KYC for review
 */
export const submitKyc = async (userId: string, data: KycSubmitData) => {
  const org = await getUserOrganization(userId);
  const kyc = await getOrCreateKyc(org.id);

  // Can only submit if NOT_SUBMITTED or REJECTED
  if (kyc.status !== KycStatus.NOT_SUBMITTED && kyc.status !== KycStatus.REJECTED) {
    throw AppError.badRequest('KYC is already submitted or approved');
  }

  // Validate all required documents are uploaded - MADE OPTIONAL
  // const requiredDocs: KycDocumentType[] = ['taxDocument', 'registrationDoc', 'businessLicense', 'idProof'];
  // const missingDocs = requiredDocs.filter(doc => {
  //   const key = `${doc}Key` as keyof typeof kyc;
  //   return !kyc[key];
  // });

  // if (missingDocs.length > 0) {
  //   throw AppError.badRequest(`Missing required documents: ${missingDocs.join(', ')}`);
  // }

  // Update KYC with business info and mark as PENDING
  const updated = await prisma.kycSubmission.update({
    where: { id: kyc.id },
    data: {
      businessRegisteredName: data.businessRegisteredName,
      taxId: data.taxId,
      phoneNumber: data.phoneNumber,
      businessAddress: data.businessAddress,
      status: KycStatus.PENDING,
      submittedAt: new Date(),
      rejectionReason: null, // Clear any previous rejection reason
    },
  });

  return {
    status: updated.status,
    submittedAt: updated.submittedAt,
  };
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Get all KYC submissions (Admin)
 */
export const getAllKycSubmissions = async (filters?: {
  status?: KycStatus | undefined;
  orgType?: 'NGO' | 'SUPPLIER' | undefined;
}) => {
  const where: Record<string, unknown> = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.orgType) {
    where.organization = {
      type: filters.orgType,
    };
  }

  const submissions = await prisma.kycSubmission.findMany({
    where,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
  });

  return submissions.map(kyc => ({
    id: kyc.id,
    orgId: kyc.orgId,
    orgName: kyc.organization.name,
    orgType: kyc.organization.type,
    status: kyc.status,
    businessRegisteredName: kyc.businessRegisteredName,
    taxId: kyc.taxId,
    phoneNumber: kyc.phoneNumber,
    submittedAt: kyc.submittedAt,
    reviewedAt: kyc.reviewedAt,
  }));
};

/**
 * Get single KYC submission details (Admin)
 */
export const getKycById = async (kycId: string) => {
  const kyc = await prisma.kycSubmission.findUnique({
    where: { id: kycId },
    include: {
      organization: true,
    },
  });

  if (!kyc) {
    throw AppError.notFound('KYC submission not found');
  }

  return kyc;
};

/**
 * Get signed URL for a KYC document (Admin only)
 */
export const getDocumentUrl = async (
  kycId: string,
  docType: KycDocumentType,
  adminEmail: string
) => {
  const kyc = await getKycById(kycId);
  
  const docKeyField = `${docType}Key` as keyof typeof kyc;
  const publicId = kyc[docKeyField] as string | null;

  if (!publicId) {
    throw AppError.notFound(`Document ${docType} not found`);
  }

  // Generate watermark text
  const timestamp = new Date().toISOString();
  const watermarkText = `Viewed by: ${adminEmail} | ${timestamp}`;

  // Check if it's an image (for watermark) or raw file
  if (isImageDocument(publicId)) {
    return {
      url: generateSignedUrl(publicId, {
        expiresInSeconds: 60,
        watermarkText,
      }),
      expiresIn: 60,
    };
  }

  // For PDFs and other raw files
  return {
    url: generateSignedRawUrl(publicId, 60),
    expiresIn: 60,
  };
};

/**
 * Approve KYC submission (Admin)
 */
export const approveKyc = async (
  kycId: string,
  adminId: string,
  reviewNotes?: string
) => {
  const kyc = await getKycById(kycId);

  if (kyc.status !== KycStatus.PENDING) {
    throw AppError.badRequest('Can only approve pending KYC submissions');
  }

  // Update KYC status
  const updated = await prisma.kycSubmission.update({
    where: { id: kycId },
    data: {
      status: KycStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      reviewNotes: reviewNotes ?? null,
    },
  });

  // Mark organization as verified
  await prisma.organization.update({
    where: { id: kyc.orgId },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: adminId,
    },
  });

  return {
    status: updated.status,
    reviewedAt: updated.reviewedAt,
  };
};

/**
 * Reject KYC submission (Admin)
 */
export const rejectKyc = async (
  kycId: string,
  adminId: string,
  rejectionReason: string,
  reviewNotes?: string
) => {
  if (!rejectionReason.trim()) {
    throw AppError.badRequest('Rejection reason is required');
  }

  const kyc = await getKycById(kycId);

  if (kyc.status !== KycStatus.PENDING) {
    throw AppError.badRequest('Can only reject pending KYC submissions');
  }

  const updated = await prisma.kycSubmission.update({
    where: { id: kycId },
    data: {
      status: KycStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason,
      reviewNotes: reviewNotes ?? null,
    },
  });

  // Ensure organization is not verified
  await prisma.organization.update({
    where: { id: kyc.orgId },
    data: {
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
    },
  });

  return {
    status: updated.status,
    reviewedAt: updated.reviewedAt,
    rejectionReason: updated.rejectionReason,
  };
};
