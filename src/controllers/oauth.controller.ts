import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as oauthService from '../services/oauth.service';
import { env } from '../config/env';
import type { GoogleAuthSchemaType, LinkGoogleSchemaType } from '../schema/oauth.schema';
import type { ApiResponse, SafeUser } from '../types/index';

/**
 * OAuth Controller
 * Handles HTTP requests for Google OAuth authentication
 */

/**
 * Cookie options for tokens
 */
const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  maxAge,
  path: '/',
});

/**
 * Set auth cookies on response
 */
const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  // Access token: 15 minutes
  res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));

  // Refresh token: 7 days
  res.cookie('refreshToken', refreshToken, {
    ...getCookieOptions(7 * 24 * 60 * 60 * 1000),
    path: '/api/auth', // Only send to auth routes
  });
};

/**
 * Get client info from request
 */
const getClientInfo = (req: Request) => ({
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip ?? req.socket.remoteAddress,
});

/**
 * POST /auth/google
 * Google OAuth signup/signin
 * - New users: Creates account with specified role
 * - Existing users: Signs in (role param ignored)
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = req.body as GoogleAuthSchemaType;
  const { userAgent, ipAddress } = getClientInfo(req);

  const { user, tokens, isNewUser } = await oauthService.googleAuth(
    {
      googleToken: data.googleToken,
      role: data.role,
      organizationName: data.organizationName,
    },
    userAgent,
    ipAddress
  );

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  const response: ApiResponse<SafeUser & { isNewUser: boolean }> = {
    success: true,
    data: { ...user, isNewUser },
    message: isNewUser ? 'Account created successfully' : 'Signed in successfully',
  };

  res.status(isNewUser ? 201 : 200).json(response);
});

/**
 * POST /auth/google/link
 * Link Google account to existing email/password account
 * Requires authentication
 */
export const linkGoogle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const { googleToken } = req.body as LinkGoogleSchemaType;

  const user = await oauthService.linkGoogleAccount(req.user.userId, googleToken);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Google account linked successfully',
  };

  res.status(200).json(response);
});
