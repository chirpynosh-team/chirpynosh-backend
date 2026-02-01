import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../utils/token';
import {
  generateOtp,
  hashOtp,
  getOtpExpiry,
  verifyOtpHash,
  isOtpExpired,
  isMaxAttemptsExceeded,
} from '../utils/otp';
import { constantTimeCompare } from '../utils/crypto';
import { sendOtpEmail } from './email.service';
import type { SafeUser, AuthTokens, SignupInput, SigninInput, ProfileStatus } from '../types/auth.types';
import type { Role } from '../generated/prisma/client';

/**
 * Auth Service
 * Business logic for authentication operations
 */

// Type for user with profile includes
type UserWithProfiles = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  ngoProfile?: { isVerified: boolean; orgName: string; verifiedAt: Date | null } | null;
  supplierProfile?: { isVerified: boolean; businessName: string; verifiedAt: Date | null } | null;
};

/**
 * Get profile status based on user role and profile
 */
const getProfileStatus = (user: UserWithProfiles): ProfileStatus | null => {
  if (user.role === 'NGO_RECIPIENT' && user.ngoProfile) {
    return {
      isVerified: user.ngoProfile.isVerified,
      orgName: user.ngoProfile.orgName,
      verifiedAt: user.ngoProfile.verifiedAt,
    };
  }
  if (user.role === 'FOOD_SUPPLIER' && user.supplierProfile) {
    return {
      isVerified: user.supplierProfile.isVerified,
      orgName: user.supplierProfile.businessName,
      verifiedAt: user.supplierProfile.verifiedAt,
    };
  }
  return null; // SIMPLE_RECIPIENT and ADMIN don't have profiles
};

/**
 * Format user for safe response (exclude sensitive fields)
 */
const formatSafeUser = (user: UserWithProfiles): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  profileStatus: getProfileStatus(user),
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
 * Store refresh token in database (hashed)
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
 * Create and send OTP to user
 */
const createAndSendOtp = async (userId: string, email: string, name?: string | null): Promise<void> => {
  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  // Upsert OTP (replace if exists)
  await prisma.otp.upsert({
    where: { userId },
    update: {
      otpHash,
      expiresAt: getOtpExpiry(),
      attempts: 0,
    },
    create: {
      userId,
      otpHash,
      expiresAt: getOtpExpiry(),
    },
  });

  // Send OTP via email
  await sendOtpEmail(email, otp, name ?? undefined);
};

/**
 * Create role-specific profile (NGO or Supplier)
 */
const createRoleProfile = async (
  userId: string,
  role: Role,
  organizationName: string
): Promise<void> => {
  if (role === 'NGO_RECIPIENT') {
    await prisma.nGOProfile.create({
      data: {
        userId,
        orgName: organizationName,
      },
    });
  } else if (role === 'FOOD_SUPPLIER') {
    await prisma.supplierProfile.create({
      data: {
        userId,
        businessName: organizationName,
      },
    });
  }
};

/**
 * Signup - Create new user and send OTP
 * ❌ Does NOT issue tokens - OTP verification required first
 * ❌ ADMIN role is rejected
 */
export const signup = async (
  data: SignupInput
): Promise<{ message: string }> => {
  // CRITICAL: Reject ADMIN role signup
  if ((data.role as string) === 'ADMIN') {
    throw AppError.forbidden('Invalid role selection', 'INVALID_ROLE');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    // If user exists but not verified, resend OTP
    if (!existingUser.isEmailVerified) {
      await createAndSendOtp(existingUser.id, existingUser.email, existingUser.name);
      return { message: 'Verification code sent to your email' };
    }
    throw AppError.conflict('A user with this email already exists', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user (unverified)
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name ?? null,
      role: data.role,
      isEmailVerified: false,
    },
  });

  // Create role-specific profile if needed
  if ((data.role === 'NGO_RECIPIENT' || data.role === 'FOOD_SUPPLIER') && data.organizationName) {
    await createRoleProfile(user.id, data.role, data.organizationName);
  }

  // Create and send OTP
  await createAndSendOtp(user.id, user.email, user.name);

  return { message: 'Verification code sent to your email' };
};

/**
 * Verify OTP - Mark user as email verified and issue tokens
 */
export const verifyOtp = async (
  email: string,
  otp: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> => {
  // Find user by email with profiles
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      otp: true,
      ngoProfile: true,
      supplierProfile: true,
    },
  });

  if (!user || !user.otp) {
    throw AppError.badRequest('Invalid or expired verification code', 'INVALID_OTP');
  }

  // Check if already verified
  if (user.isEmailVerified) {
    throw AppError.badRequest('Email is already verified', 'ALREADY_VERIFIED');
  }

  // Check if max attempts exceeded
  if (isMaxAttemptsExceeded(user.otp.attempts)) {
    await prisma.otp.delete({ where: { userId: user.id } });
    throw AppError.badRequest('Too many failed attempts. Please request a new code.', 'MAX_ATTEMPTS');
  }

  // Check if OTP expired
  if (isOtpExpired(user.otp.expiresAt)) {
    await prisma.otp.delete({ where: { userId: user.id } });
    throw AppError.badRequest('Verification code has expired. Please request a new code.', 'OTP_EXPIRED');
  }

  // Verify OTP hash
  if (!verifyOtpHash(otp, user.otp.otpHash)) {
    await prisma.otp.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } },
    });
    throw AppError.badRequest('Invalid verification code', 'INVALID_OTP');
  }

  // OTP is valid - mark user as email verified and delete OTP
  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true },
    include: {
      ngoProfile: true,
      supplierProfile: true,
    },
  });

  await prisma.otp.delete({ where: { userId: user.id } });

  // Generate and store tokens
  const safeUser = formatSafeUser(verifiedUser);
  const tokens = generateTokens(safeUser);

  await storeRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

  return { user: safeUser, tokens };
};

/**
 * Resend OTP to user's email
 */
export const resendOtp = async (email: string): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If the email exists, a verification code will be sent' };
  }

  if (user.isEmailVerified) {
    return { message: 'If the email exists, a verification code will be sent' };
  }

  // Create and send new OTP
  await createAndSendOtp(user.id, user.email, user.name);

  return { message: 'If the email exists, a verification code will be sent' };
};

/**
 * Signin - Authenticate user (must be email verified)
 */
export const signin = async (
  data: SigninInput,
  userAgent?: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> => {
  // Find user by email with profiles
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      ngoProfile: true,
      supplierProfile: true,
    },
  });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Check if user is email verified
  if (!user.isEmailVerified) {
    throw AppError.forbidden(
      'Please verify your email first. Check your inbox for the verification code.',
      'EMAIL_NOT_VERIFIED'
    );
  }

  // Verify password
  const isPasswordValid = await comparePassword(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const safeUser = formatSafeUser(user);
  const tokens = generateTokens(safeUser);

  // Store refresh token
  await storeRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

  return { user: safeUser, tokens };
};

/**
 * Refresh tokens - Rotate refresh token and issue new access token
 */
export const refreshTokens = async (
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> => {
  // Verify the refresh token JWT
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (payload.type !== 'refresh') {
    throw AppError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
  }

  // Hash the incoming token to compare with stored hash
  const tokenHash = hashToken(refreshToken);

  // Find the token in database
  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId: payload.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          ngoProfile: true,
          supplierProfile: true,
        },
      },
    },
  });

  if (!storedToken) {
    // Token not found or already revoked - possible replay attack
    await prisma.refreshToken.updateMany({
      where: { userId: payload.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    throw AppError.unauthorized(
      'Refresh token is invalid or has been revoked',
      'TOKEN_REVOKED'
    );
  }

  // Verify token hash matches (constant-time comparison)
  if (!constantTimeCompare(storedToken.tokenHash, tokenHash)) {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Revoke the old refresh token (token rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Generate new tokens
  const safeUser = formatSafeUser(storedToken.user);
  const tokens = generateTokens(safeUser);

  // Store new refresh token
  await storeRefreshToken(safeUser.id, tokens.refreshToken, userAgent, ipAddress);

  return { user: safeUser, tokens };
};

/**
 * Logout - Revoke refresh token
 */
export const logout = async (refreshToken: string): Promise<void> => {
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * Logout from all devices - Revoke all refresh tokens
 */
export const logoutAll = async (userId: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * Get current user by ID
 */
export const getMe = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ngoProfile: true,
      supplierProfile: true,
    },
  });

  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  return formatSafeUser(user);
};
