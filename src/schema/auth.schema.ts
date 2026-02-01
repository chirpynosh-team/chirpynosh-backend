import { z } from 'zod';

/**
 * Auth Validation Schemas
 * Zod schemas for input validation
 */

/**
 * Allowed signup roles (ADMIN is never self-assignable)
 */
export const ALLOWED_SIGNUP_ROLES = ['SIMPLE_RECIPIENT', 'NGO_RECIPIENT', 'FOOD_SUPPLIER'] as const;

/**
 * Email validation with normalization
 */
const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform((email) => email.toLowerCase().trim());

/**
 * Password validation
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Signup Schema with role selection
 * - ADMIN role is rejected at schema level
 * - NGO_RECIPIENT and FOOD_SUPPLIER require organization name
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),
  role: z.enum(ALLOWED_SIGNUP_ROLES).default('SIMPLE_RECIPIENT'),
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(200, 'Organization name must be at most 200 characters')
    .trim()
    .optional(),
}).refine(
  (data) => {
    // Require organizationName for NGO and Supplier roles
    if (data.role === 'NGO_RECIPIENT' || data.role === 'FOOD_SUPPLIER') {
      return !!data.organizationName;
    }
    return true;
  },
  {
    message: 'Organization/Business name is required for NGO and Supplier roles',
    path: ['organizationName'],
  }
);

/**
 * Signin Schema
 */
export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Infer types from schemas
 */
export type SignupSchemaType = z.infer<typeof signupSchema>;
export type SigninSchemaType = z.infer<typeof signinSchema>;
