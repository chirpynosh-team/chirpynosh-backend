import { z } from 'zod';

/**
 * OTP Validation Schemas
 */

/**
 * Email schema with normalization
 */
const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform((email) => email.toLowerCase().trim());

/**
 * OTP format validation
 */
const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

/**
 * Verify OTP Schema
 */
export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

/**
 * Resend OTP Schema
 */
export const resendOtpSchema = z.object({
  email: emailSchema,
});

/**
 * Infer types
 */
export type VerifyOtpSchemaType = z.infer<typeof verifyOtpSchema>;
export type ResendOtpSchemaType = z.infer<typeof resendOtpSchema>;
