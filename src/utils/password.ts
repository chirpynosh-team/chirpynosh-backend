import bcrypt from 'bcryptjs';

/**
 * Password Utilities
 * Handles password hashing and comparison using bcrypt
 */

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a password with a hash
 * Uses bcrypt's built-in timing-safe comparison
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
