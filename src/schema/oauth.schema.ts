import { z } from 'zod';
import { ALLOWED_SIGNUP_ROLES } from './auth.schema';

/**
 * OAuth Validation Schemas
 */

/**
 * Google OAuth Schema
 * Used for both signup and signin with Google
 */
export const googleAuthSchema = z.object({
  googleToken: z.string().min(1, 'Google token is required'),
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
 * Link Google Schema
 * Used to link Google account to existing email account
 */
export const linkGoogleSchema = z.object({
  googleToken: z.string().min(1, 'Google token is required'),
});

/**
 * Infer types from schemas
 */
export type GoogleAuthSchemaType = z.infer<typeof googleAuthSchema>;
export type LinkGoogleSchemaType = z.infer<typeof linkGoogleSchema>;
