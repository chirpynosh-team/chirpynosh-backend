import type { Role } from '../generated/prisma/client';

/**
 * Authentication Types
 */

/**
 * Allowed signup roles (ADMIN excluded)
 */
export type AllowedSignupRole = 'SIMPLE_RECIPIENT' | 'NGO_RECIPIENT' | 'FOOD_SUPPLIER';

/**
 * JWT Token Payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Signup Input
 */
export interface SignupInput {
  email: string;
  password: string;
  name?: string | undefined;
  role: AllowedSignupRole;
  organizationName?: string | undefined;
}

/**
 * Signin Input
 */
export interface SigninInput {
  email: string;
  password: string;
}

/**
 * Auth Tokens Pair
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Profile verification status (for NGO/Supplier)
 */
export interface ProfileStatus {
  isVerified: boolean;
  orgName: string;
  verifiedAt: Date | null;
}

/**
 * Safe User (without sensitive fields)
 */
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isEmailVerified: boolean;
  profileStatus: ProfileStatus | null; // null for SIMPLE_RECIPIENT
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auth Response (user + tokens info, tokens are in cookies)
 */
export interface AuthResponse {
  user: SafeUser;
  message: string;
}
