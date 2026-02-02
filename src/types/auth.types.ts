import type { Role, OrgType, OrgRole } from '../generated/prisma/client';

/**
 * Authentication Types
 */

/**
 * Allowed signup roles (ADMIN excluded)
 */
export type AllowedSignupRole = 'SIMPLE_RECIPIENT' | 'NGO_RECIPIENT' | 'FOOD_SUPPLIER';

/**
 * Auth provider types
 */
export type AuthProviderType = 'EMAIL' | 'GOOGLE';

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
 * Signup Input (Email/Password)
 */
export interface SignupInput {
  email: string;
  password: string;
  name?: string | undefined;
  role: AllowedSignupRole;
  organizationName?: string | undefined;
}

/**
 * Google OAuth Signup Input
 */
export interface GoogleSignupInput {
  googleToken: string;
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
 * Organization info for user response
 */
export interface OrgInfo {
  id: string;
  name: string;
  type: OrgType;
  isVerified: boolean;
  userRole: OrgRole;
}

/**
 * Safe User (without sensitive fields)
 */
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  avatar: string | null;
  authProvider: AuthProviderType;
  isEmailVerified: boolean;
  organization: OrgInfo | null; // null for SIMPLE_RECIPIENT
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

/**
 * Google user info from token verification
 */
export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
}
