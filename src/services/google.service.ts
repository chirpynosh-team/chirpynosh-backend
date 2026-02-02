import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import type { GoogleUserInfo } from '../types/auth.types';

/**
 * Google OAuth Service
 * Handles Google token verification and user info extraction
 */

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token and extract user info
 */
export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserInfo> => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid Google token payload');
    }

    if (!payload.email) {
      throw new Error('Google account does not have an email');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      avatar: payload.picture ?? null,
      emailVerified: payload.email_verified ?? false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google authentication failed: ${error.message}`);
    }
    throw new Error('Google authentication failed');
  }
};
