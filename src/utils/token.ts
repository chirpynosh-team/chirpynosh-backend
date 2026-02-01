import { env } from '../config/env';
import type { TokenPayload } from '../types/auth.types';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

/**
 * Token Utilities
 * Handles JWT generation, verification, and token hashing
 */

/**
 * Parse expiration string to seconds
 * Supports formats like '15m', '7d', '1h'
 */
const parseToSeconds = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * (multipliers[unit!] ?? 0);
};

/**
 * Generate an access token (short-lived)
 */
export const generateAccessToken = (payload: Omit<TokenPayload, 'type'>): string => {
  const tokenPayload: TokenPayload = { ...payload, type: 'access' };
  const expiresInSeconds = parseToSeconds(env.ACCESS_TOKEN_EXPIRES_IN);
  
  return jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, { expiresIn: expiresInSeconds });
};

/**
 * Generate a refresh token (long-lived)
 */
export const generateRefreshToken = (payload: Omit<TokenPayload, 'type'>): string => {
  const tokenPayload: TokenPayload = { ...payload, type: 'refresh' };
  const expiresInSeconds = parseToSeconds(env.REFRESH_TOKEN_EXPIRES_IN);
  
  return jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, { expiresIn: expiresInSeconds });
};

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};

/**
 * Hash a token using SHA-256
 * Used for storing refresh tokens securely in the database
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Parse expiration string to milliseconds
 * Supports formats like '15m', '7d', '1h'
 */
export const parseExpiresIn = (expiresIn: string): number => {
  return parseToSeconds(expiresIn) * 1000;
};

/**
 * Get refresh token expiry date
 */
export const getRefreshTokenExpiry = (): Date => {
  return new Date(Date.now() + parseExpiresIn(env.REFRESH_TOKEN_EXPIRES_IN));
};
