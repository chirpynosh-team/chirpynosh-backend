import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import type { SignupSchemaType, SigninSchemaType } from '../schema/auth.schema';
import type { VerifyOtpSchemaType, ResendOtpSchemaType } from '../schema/otp.schema';
import type { ApiResponse, SafeUser } from '../types/index';

/**
 * Auth Controller
 * Handles HTTP requests and responses for authentication
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
 * Clear auth cookies
 */
const clearAuthCookies = (res: Response): void => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
};

/**
 * Get client info from request
 */
const getClientInfo = (req: Request) => ({
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip ?? req.socket.remoteAddress,
});

/**
 * POST /auth/signup
 * Create a new user account and send OTP
 * ❌ Does NOT issue tokens - OTP verification required
 */
export const signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = req.body as SignupSchemaType;

  const result = await authService.signup(data);

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: result,
    message: 'Please check your email for the verification code',
  };

  res.status(201).json(response);
});

/**
 * POST /auth/verify-otp
 * Verify OTP and issue tokens
 */
export const verifyOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body as VerifyOtpSchemaType;
  const { userAgent, ipAddress } = getClientInfo(req);

  const { user, tokens } = await authService.verifyOtp(email, otp, userAgent, ipAddress);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Email verified successfully',
  };

  res.status(200).json(response);
});

/**
 * POST /auth/resend-otp
 * Resend OTP to user's email
 */
export const resendOtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as ResendOtpSchemaType;

  const result = await authService.resendOtp(email);

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: result,
  };

  res.status(200).json(response);
});

/**
 * POST /auth/signin
 * Authenticate user and return tokens
 * Requires user to be verified
 */
export const signin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = req.body as SigninSchemaType;
  const { userAgent, ipAddress } = getClientInfo(req);

  const { user, tokens } = await authService.signin(data, userAgent, ipAddress);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Signed in successfully',
  };

  res.status(200).json(response);
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token is required', 'NO_REFRESH_TOKEN');
  }

  const { userAgent, ipAddress } = getClientInfo(req);
  const { user, tokens } = await authService.refreshTokens(refreshToken, userAgent, ipAddress);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Tokens refreshed successfully',
  };

  res.status(200).json(response);
});

/**
 * POST /auth/logout
 * Revoke refresh token and clear cookies
 */
export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  clearAuthCookies(res);

  const response: ApiResponse<null> = {
    success: true,
    data: null,
    message: 'Logged out successfully',
  };

  res.status(200).json(response);
});

/**
 * POST /auth/logout-all
 * Revoke all refresh tokens for the user
 */
export const logoutAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  await authService.logoutAll(req.user.userId);

  clearAuthCookies(res);

  const response: ApiResponse<null> = {
    success: true,
    data: null,
    message: 'Logged out from all devices successfully',
  };

  res.status(200).json(response);
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const user = await authService.getMe(req.user.userId);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
  };

  res.status(200).json(response);
});
