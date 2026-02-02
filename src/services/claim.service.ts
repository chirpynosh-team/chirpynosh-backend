import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { ListingStatus, ClaimStatus, ClaimerType, Role } from '../generated/prisma/client';
import type { CreateClaimInput } from '../schema/listing.schema';
import crypto from 'crypto';
import * as emailService from './email.service';

// ============================================================================
// USER CLAIM FUNCTIONS
// ============================================================================

/**
 * Create a new claim (user claims from a listing)
 */
export const createClaim = async (userId: string, data: CreateClaimInput) => {
  // Get user with their role and org memberships
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orgMemberships: {
        include: {
          org: {
            select: { id: true, type: true, isVerified: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Get the listing
  const listing = await prisma.foodListing.findFirst({
    where: {
      id: data.listingId,
      status: ListingStatus.ACTIVE,
      expiresAt: { gt: new Date() },
      organization: {
        isVerified: true,
        isRestricted: false,
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!listing) {
    throw AppError.notFound('Listing not found or no longer available');
  }

  // Check stock
  if (listing.remainingStock < data.quantity) {
    throw AppError.badRequest(`Only ${listing.remainingStock} ${listing.unit} available`);
  }

  // Check claimer type eligibility
  let claimerOrgId: string | null = null;
  const isNgo = user.role === Role.NGO_RECIPIENT;
  const isIndividual = user.role === Role.SIMPLE_RECIPIENT;

  if (listing.claimerType === ClaimerType.NGO && !isNgo) {
    throw AppError.forbidden('This listing is only available to verified NGOs');
  }

  if (listing.claimerType === ClaimerType.INDIVIDUAL && !isIndividual) {
    throw AppError.forbidden('This listing is only available to individual users');
  }

  // If NGO, get their organization
  if (isNgo) {
    const ngoMembership = user.orgMemberships.find(
      m => m.org.type === 'NGO' && m.org.isVerified
    );
    if (!ngoMembership) {
      throw AppError.forbidden('Your NGO must be verified to claim');
    }
    claimerOrgId = ngoMembership.org.id;
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // Calculate prices
  const unitPrice = Number(listing.subsidizedPrice);
  const totalPrice = unitPrice * data.quantity;

  // Create claim in transaction
  const claim = await prisma.$transaction(async (tx) => {
    // Reduce stock
    const updatedListing = await tx.foodListing.update({
      where: { id: listing.id },
      data: {
        remainingStock: { decrement: data.quantity },
      },
    });

    // Mark as sold out if no stock left
    if (updatedListing.remainingStock <= 0) {
      await tx.foodListing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.SOLD_OUT },
      });
    }

    // Create claim
    return tx.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: userId,
        claimerOrgId,
        quantity: data.quantity,
        unitPrice,
        totalPrice,
        pickupOtpHash: otpHash,
        status: ClaimStatus.PENDING,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            unit: true,
            pickupStartAt: true,
            pickupEndAt: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
  });

  // Send OTP via email
  try {
    await emailService.sendPickupOtp({
      email: user.email,
      name: user.name || 'Valued Customer',
      otp,
      listingTitle: claim.listing.title,
      supplierName: claim.listing.organization.name,
      quantity: data.quantity,
      unit: claim.listing.unit,
      pickupStart: claim.listing.pickupStartAt,
      pickupEnd: claim.listing.pickupEndAt,
    });
  } catch (error) {
    console.error('Failed to send pickup OTP email:', error);
    // Don't fail the claim if email fails
  }

  return {
    ...claim,
    otp, // Return OTP in response (also sent via email)
  };
};

/**
 * Get user's claims
 */
export const getUserClaims = async (
  userId: string,
  options: { status?: ClaimStatus; page?: number; limit?: number } = {}
) => {
  const { status, page = 1, limit = 20 } = options;

  const where = {
    claimerId: userId,
    ...(status && { status }),
  };

  const [claims, total] = await Promise.all([
    prisma.foodClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            unit: true,
            pickupStartAt: true,
            pickupEndAt: true,
            organization: { select: { id: true, name: true } },
          },
        },
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
 * Get a single claim by ID (for claimer)
 */
export const getClaimById = async (userId: string, claimId: string) => {
  const claim = await prisma.foodClaim.findFirst({
    where: {
      id: claimId,
      claimerId: userId,
    },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          unit: true,
          pickupStartAt: true,
          pickupEndAt: true,
          imageKeys: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!claim) {
    throw AppError.notFound('Claim not found');
  }

  return claim;
};

/**
 * Cancel a claim (by claimer)
 */
export const cancelClaim = async (userId: string, claimId: string, reason?: string) => {
  const claim = await prisma.foodClaim.findFirst({
    where: {
      id: claimId,
      claimerId: userId,
    },
    include: {
      listing: true,
    },
  });

  if (!claim) {
    throw AppError.notFound('Claim not found');
  }

  if (claim.status !== ClaimStatus.PENDING) {
    throw AppError.badRequest('Only pending claims can be cancelled');
  }

  // Cancel and restore stock in transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Restore stock
    await tx.foodListing.update({
      where: { id: claim.listingId },
      data: {
        remainingStock: { increment: claim.quantity },
        // Restore to active if was sold out
        status: claim.listing.status === ListingStatus.SOLD_OUT 
          ? ListingStatus.ACTIVE 
          : claim.listing.status,
      },
    });

    // Cancel claim
    return tx.foodClaim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by claimer',
      },
    });
  });

  return updated;
};

/**
 * Resend pickup OTP to claimer
 */
export const resendPickupOtp = async (userId: string, claimId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  const claim = await prisma.foodClaim.findFirst({
    where: {
      id: claimId,
      claimerId: userId,
      status: ClaimStatus.PENDING,
    },
    include: {
      listing: {
        select: {
          title: true,
          unit: true,
          pickupStartAt: true,
          pickupEndAt: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!claim) {
    throw AppError.notFound('Pending claim not found');
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // Update claim with new OTP
  await prisma.foodClaim.update({
    where: { id: claimId },
    data: { pickupOtpHash: otpHash },
  });

  // Send OTP via email
  await emailService.sendPickupOtp({
    email: user.email,
    name: user.name || 'Valued Customer',
    otp,
    listingTitle: claim.listing.title,
    supplierName: claim.listing.organization.name,
    quantity: claim.quantity,
    unit: claim.listing.unit,
    pickupStart: claim.listing.pickupStartAt,
    pickupEnd: claim.listing.pickupEndAt,
  });

  return { success: true, message: 'OTP sent to your email' };
};
