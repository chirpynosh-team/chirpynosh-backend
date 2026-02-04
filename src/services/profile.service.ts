import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { uploadAvatar, deleteAvatar, getAvatarUrl } from './upload.service';
import type { SafeUser, OrgInfo, AuthProviderType } from '../types/auth.types';
import type { Role, OrgType } from '../generated/prisma/client';

/**
 * Profile Service
 * Business logic for user profile operations
 */

// Type for user with org membership includes
type UserWithOrg = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  avatar: string | null;
  authProvider: 'EMAIL' | 'GOOGLE';
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  orgMemberships: Array<{
    orgRole: 'OWNER' | 'MANAGER' | 'MEMBER';
    org: {
      id: string;
      name: string;
      type: OrgType;
      isVerified: boolean;
    };
  }>;
};

/**
 * Get organization info from user's memberships
 */
const getOrgInfo = (user: UserWithOrg): OrgInfo | null => {
  if (user.orgMemberships.length === 0) {
    return null;
  }
  
  const membership = user.orgMemberships[0]!;
  return {
    id: membership.org.id,
    name: membership.org.name,
    type: membership.org.type,
    isVerified: membership.org.isVerified,
    userRole: membership.orgRole,
  };
};

/**
 * Format user for safe response
 */
const formatSafeUser = (user: UserWithOrg): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
  authProvider: user.authProvider as AuthProviderType,
  isEmailVerified: user.isEmailVerified,
  organization: getOrgInfo(user),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * Get user by ID with organization info
 */
export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orgMemberships: {
        include: {
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return formatSafeUser(user);
};

/**
 * Update user profile (name only - email changes require verification)
 */
export const updateProfile = async (
  userId: string,
  data: { name?: string }
): Promise<SafeUser> => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      updatedAt: new Date(),
    },
    include: {
      orgMemberships: {
        include: {
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  return formatSafeUser(user);
};

/**
 * Upload and update user avatar
 */
export const updateAvatar = async (
  userId: string,
  fileBuffer: Buffer
): Promise<SafeUser> => {
  // Get current user to check for existing avatar
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  // Delete old avatar if exists
  if (currentUser?.avatar) {
    // Extract public_id from URL or use stored value
    const oldPublicId = extractPublicIdFromUrl(currentUser.avatar);
    if (oldPublicId) {
      await deleteAvatar(oldPublicId);
    }
  }

  // Upload new avatar
  const uploadResult = await uploadAvatar(fileBuffer, userId);
  const avatarUrl = getAvatarUrl(uploadResult.publicId);

  // Update user with new avatar URL
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      avatar: avatarUrl,
      updatedAt: new Date(),
    },
    include: {
      orgMemberships: {
        include: {
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  return formatSafeUser(user);
};

/**
 * Delete user avatar
 */
export const deleteUserAvatar = async (userId: string): Promise<SafeUser> => {
  // Get current user to check for existing avatar
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  // Delete avatar from Cloudinary if exists
  if (currentUser?.avatar) {
    const publicId = extractPublicIdFromUrl(currentUser.avatar);
    if (publicId) {
      await deleteAvatar(publicId);
    }
  }

  // Update user to remove avatar
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      avatar: null,
      updatedAt: new Date(),
    },
    include: {
      orgMemberships: {
        include: {
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  return formatSafeUser(user);
};

/**
 * Extract Cloudinary public_id from URL
 */
const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    // Cloudinary URLs follow pattern: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}
    const match = url.match(/\/chirpynosh\/avatars\/[^/]+/);
    if (match) {
      return match[0].substring(1); // Remove leading slash
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Get profile stats for a user
 */
export const getProfileStats = async (userId: string): Promise<{
  totalClaims: number;
  completedClaims: number;
  pendingClaims: number;
  cancelledClaims: number;
  totalListings?: number;
  activeListings?: number;
}> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Get claim stats
  const claimStats = await prisma.claim.groupBy({
    by: ['status'],
    where: { userId },
    _count: { status: true },
  });

  const stats = {
    totalClaims: 0,
    completedClaims: 0,
    pendingClaims: 0,
    cancelledClaims: 0,
  };

  claimStats.forEach((stat) => {
    stats.totalClaims += stat._count.status;
    if (stat.status === 'COMPLETED') stats.completedClaims = stat._count.status;
    if (stat.status === 'PENDING') stats.pendingClaims = stat._count.status;
    if (stat.status === 'CANCELLED') stats.cancelledClaims = stat._count.status;
  });

  // For food suppliers, also get listing stats
  if (user.role === 'FOOD_SUPPLIER') {
    const orgMembership = await prisma.orgMembership.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (orgMembership) {
      const listingStats = await prisma.listing.groupBy({
        by: ['status'],
        where: { orgId: orgMembership.orgId },
        _count: { status: true },
      });

      let totalListings = 0;
      let activeListings = 0;

      listingStats.forEach((stat) => {
        totalListings += stat._count.status;
        if (stat.status === 'AVAILABLE') activeListings = stat._count.status;
      });

      return { ...stats, totalListings, activeListings };
    }
  }

  return stats;
};
