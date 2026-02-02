import { z } from 'zod';

// ============================================================================
// PAGINATION
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    role: z.enum(['SIMPLE_RECIPIENT', 'NGO_RECIPIENT', 'FOOD_SUPPLIER', 'ADMIN']).optional(),
    isRestricted: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    isEmailVerified: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    search: z.string().min(1).max(100).optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['SIMPLE_RECIPIENT', 'NGO_RECIPIENT', 'FOOD_SUPPLIER', 'ADMIN']).optional(),
    isEmailVerified: z.boolean().optional(),
  }),
});

export const restrictUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const listOrgsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    type: z.enum(['NGO', 'SUPPLIER']).optional(),
    isVerified: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    isRestricted: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    search: z.string().min(1).max(100).optional(),
  }),
});

export const getOrgByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
});

export const restrictOrgSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
  body: z.object({
    reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  }),
});

export const orgIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid organization ID'),
  }),
});

// ============================================================================
// KYC SCHEMAS (Enhanced)
// ============================================================================

export const listKycPaginatedSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
    orgType: z.enum(['NGO', 'SUPPLIER']).optional(),
    search: z.string().min(1).max(100).optional(),
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type RestrictUserInput = z.infer<typeof restrictUserSchema>;
export type ListOrgsInput = z.infer<typeof listOrgsSchema>;
export type GetOrgByIdInput = z.infer<typeof getOrgByIdSchema>;
export type RestrictOrgInput = z.infer<typeof restrictOrgSchema>;
export type ListKycPaginatedInput = z.infer<typeof listKycPaginatedSchema>;
