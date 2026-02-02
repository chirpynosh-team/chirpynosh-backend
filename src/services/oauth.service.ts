import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../utils/token';
import { verifyGoogleToken } from './google.service';
import type {
  SafeUser,
  AuthTokens,
  GoogleSignupInput,
  OrgInfo,
  AuthProviderType,
  AllowedSignupRole,
} from '../types/auth.types';
import type { Role, OrgType } from '../generated/prisma/client';

/**
 * OAuth Auth Service
 * Handles Google OAuth signup and signin
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
 * Include for user queries with org
 */
const userWithOrgInclude = {
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
 * Generate tokens for a user
 */
const generateTokens = (user: SafeUser): AuthTokens => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Store refresh token in database
 */
const storeRefreshToken = async (
  userId: string,
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> => {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
};

/**
 * Map role to org type
 */
const roleToOrgType = (role: AllowedSignupRole): OrgType | null => {
  if (role === 'NGO_RECIPIENT') return 'NGO';
  if (role === 'FOOD_SUPPLIER') return 'SUPPLIER';
  return null;
};

/**
 * Google OAuth signup/signin
 * - New user: Creates account + org (if needed) + issues tokens
 * - Existing user: Signs in and issues tokens
 */
export const googleAuth = async (
  data: GoogleSignupInput,
  userAgent?: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens; isNewUser: boolean }> => {
  // CRITICAL: Reject ADMIN role
  if ((data.role as string) === 'ADMIN') {
    throw AppError.forbidden('Invalid role selection', 'INVALID_ROLE');
  }

  // Verify Google token
  const googleUser = await verifyGoogleToken(data.googleToken);

  // Check if user exists by Google ID or email
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
    },
    include: userWithOrgInclude,
  });

  let isNewUser = false;

  if (user) {
    // Existing user - check if Google account is linked
    if (!user.googleId) {
      // Link Google account to existing email account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.googleId,
          avatar: user.avatar ?? googleUser.avatar,
          isEmailVerified: true, // Google verified the email
        },
        include: userWithOrgInclude,
      });
    }
  } else {
    // New user - create account
    isNewUser = true;

    // Validate org name for NGO/Supplier
    const needsOrg = data.role === 'NGO_RECIPIENT' || data.role === 'FOOD_SUPPLIER';
    if (needsOrg && !data.organizationName) {
      throw AppError.badRequest(
        'Organization name is required for this role',
        'ORG_NAME_REQUIRED'
      );
    }

    // Create user
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        googleId: googleUser.googleId,
        name: googleUser.name,
        avatar: googleUser.avatar,
        role: data.role,
        authProvider: 'GOOGLE',
        isEmailVerified: true, // Google verified the email
      },
      include: userWithOrgInclude,
    });

    // Create organization if NGO/Supplier
    if (needsOrg && data.organizationName) {
      const orgType = roleToOrgType(data.role);
      if (orgType) {
        await prisma.organization.create({
          data: {
            type: orgType,
            name: data.organizationName,
            members: {
              create: {
                userId: user.id,
                orgRole: 'OWNER',
              },
            },
          },
        });

        // Re-fetch user with org
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: userWithOrgInclude,
        });
        
        if (updatedUser) {
          user = updatedUser;
        }
      }
    }
  }

  // Generate and store tokens
  const safeUser = formatSafeUser(user as UserWithOrg);
  const tokens = generateTokens(safeUser);

  await storeRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

  return { user: safeUser, tokens, isNewUser };
};

/**
 * Link Google account to existing email/password account
 */
export const linkGoogleAccount = async (
  userId: string,
  googleToken: string
): Promise<SafeUser> => {
  // Verify Google token
  const googleUser = await verifyGoogleToken(googleToken);

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithOrgInclude,
  });

  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  // Check if Google account is already linked to another user
  const existingGoogleUser = await prisma.user.findUnique({
    where: { googleId: googleUser.googleId },
  });

  if (existingGoogleUser && existingGoogleUser.id !== userId) {
    throw AppError.conflict(
      'This Google account is already linked to another user',
      'GOOGLE_ALREADY_LINKED'
    );
  }

  // Check email matches
  if (user.email !== googleUser.email) {
    throw AppError.badRequest(
      'Google account email does not match your account email',
      'EMAIL_MISMATCH'
    );
  }

  // Link Google account
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      googleId: googleUser.googleId,
      avatar: user.avatar ?? googleUser.avatar,
    },
    include: userWithOrgInclude,
  });

  return formatSafeUser(updatedUser);
};
