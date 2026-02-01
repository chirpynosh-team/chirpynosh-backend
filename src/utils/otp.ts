import crypto from 'node:crypto';

/**
 * OTP Utilities
 * Handles OTP generation, hashing, and verification
 */

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export const generateOtp = (): string => {
  // Generate random bytes and convert to 6-digit number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // Ensure it's always 6 digits (100000 - 999999)
  const otp = (randomNumber % 900000) + 100000;
  return otp.toString();
};

/**
 * Hash an OTP using SHA-256
 */
export const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Get OTP expiry date (10 minutes from now)
 */
export const getOtpExpiry = (): Date => {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
};

/**
 * Check if OTP has expired
 */
export const isOtpExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

/**
 * Check if max attempts exceeded
 */
export const isMaxAttemptsExceeded = (attempts: number): boolean => {
  return attempts >= MAX_OTP_ATTEMPTS;
};

/**
 * Verify OTP hash matches
 */
export const verifyOtpHash = (otp: string, storedHash: string): boolean => {
  const inputHash = hashOtp(otp);
  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
};

export const OTP_CONFIG = {
  length: OTP_LENGTH,
  expiryMinutes: OTP_EXPIRY_MINUTES,
  maxAttempts: MAX_OTP_ATTEMPTS,
} as const;
