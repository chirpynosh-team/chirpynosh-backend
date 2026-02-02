import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as oauthController from '../controllers/oauth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter, strictLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { signupSchema, signinSchema } from '../schema/auth.schema';
import { verifyOtpSchema, resendOtpSchema } from '../schema/otp.schema';
import { googleAuthSchema, linkGoogleSchema } from '../schema/oauth.schema';

/**
 * Auth Routes
 * /api/auth/*
 */

const router = Router();

// ============================================================================
// EMAIL/PASSWORD AUTH
// ============================================================================

/**
 * POST /auth/signup
 * Create a new user account and send OTP
 * Rate limited: 5 requests per minute
 */
router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  authController.signup
);

/**
 * POST /auth/verify-otp
 * Verify OTP and issue tokens
 * Strict rate limit: 3 requests per 15 minutes
 */
router.post(
  '/verify-otp',
  strictLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp
);

/**
 * POST /auth/resend-otp
 * Resend OTP to user's email
 * Strict rate limit: 3 requests per 15 minutes
 */
router.post(
  '/resend-otp',
  strictLimiter,
  validate(resendOtpSchema),
  authController.resendOtp
);

/**
 * POST /auth/signin
 * Authenticate verified user and return tokens
 * Rate limited: 5 requests per minute
 */
router.post(
  '/signin',
  authLimiter,
  validate(signinSchema),
  authController.signin
);

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

/**
 * POST /auth/google
 * Google OAuth signup/signin
 * - New users: Creates account with specified role
 * - Existing users: Signs in (role param used only for new users)
 */
router.post(
  '/google',
  authLimiter,
  validate(googleAuthSchema),
  oauthController.googleAuth
);

/**
 * POST /auth/google/link
 * Link Google account to existing email/password account
 * Requires authentication
 */
router.post(
  '/google/link',
  authenticate,
  validate(linkGoogleSchema),
  oauthController.linkGoogle
);

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * POST /auth/refresh
 * Refresh access token using refresh token from cookie
 * Rate limited: 5 requests per minute
 */
router.post(
  '/refresh',
  authLimiter,
  authController.refresh
);

/**
 * POST /auth/logout
 * Revoke refresh token and clear cookies
 * No authentication required (just clears cookies)
 */
router.post(
  '/logout',
  authController.logout
);

/**
 * POST /auth/logout-all
 * Revoke all refresh tokens for the user
 * Requires authentication
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

// ============================================================================
// USER INFO
// ============================================================================

/**
 * GET /auth/me
 * Get current authenticated user
 * Requires authentication
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

export default router;
