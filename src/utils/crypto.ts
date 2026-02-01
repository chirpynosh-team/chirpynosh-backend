import crypto from 'node:crypto';

/**
 * Crypto Utilities
 * Provides cryptographic helper functions
 */

/**
 * Constant-time comparison of two strings
 * Prevents timing attacks when comparing sensitive values like tokens
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
  // If lengths differ, perform comparison anyway to maintain constant time
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths differ, use the same length comparison but return false
  if (bufA.length !== bufB.length) {
    // Compare bufA with itself to maintain timing consistency
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Generate a cryptographically secure random string
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};
