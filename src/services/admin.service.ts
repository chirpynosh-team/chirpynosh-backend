import { prisma } from '../config/prisma';
import { Role, OrgType, KycStatus } from '../generated/prisma/client';
import { AppError } from '../utils/AppError';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface UserFilters {
  role?: Role | undefined;
  isRestricted?: boolean | undefined;
  isEmailVerified?: boolean | undefined;
  search?: string | undefined; // email or name
}

export interface OrgFilters {
  type?: OrgType | undefined;
  isVerified?: boolean | undefined;
  isRestricted?: boolean | undefined;
  search?: string | undefined; // org name
}

export interface KycFilters {
  status?: KycStatus | undefined;
  orgType?: OrgType | undefined;
  search?: string | undefined; // org name
}


// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get paginated list of users with filters
 */
export const getUsers = async (
  filters: UserFilters,
  pagination: PaginationParams
) => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.isRestricted !== undefined) {
    where.isRestricted = filters.isRestricted;
  }
  if (filters.isEmailVerified !== undefined) {
    where.isEmailVerified = filters.isEmailVerified;
  }
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        authProvider: true,
        isEmailVerified: true,
        isRestricted: true,
        restrictedAt: true,
        restrictionReason: true,
        createdAt: true,
        orgMemberships: {
          select: {
            orgRole: true,
            org: {
              select: {
                id: true,
                name: true,
                type: true,
                isVerified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + users.length < total,
  };
};

/**
 * Get single user by ID
 */
export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      googleId: true,
      authProvider: true,
      isEmailVerified: true,
      isRestricted: true,
      restrictedAt: true,
      restrictedBy: true,
      restrictionReason: true,
      createdAt: true,
      updatedAt: true,
      orgMemberships: {
        select: {
          orgRole: true,
          org: {
            select: {
              id: true,
              name: true,
              type: true,
              isVerified: true,
              kyc: {
                select: {
                  status: true,
                  submittedAt: true,
                  reviewedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return user;
};

/**
 * Update user details (admin)
 */
export const updateUser = async (
  userId: string,
  data: {
    name?: string | undefined;
    role?: Role | undefined;
    isEmailVerified?: boolean | undefined;
  }
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Prevent modifying other admins
  if (user.role === 'ADMIN' && data.role && data.role !== 'ADMIN') {
    throw AppError.forbidden('Cannot demote admin users');
  }

  // Build update data, filtering out undefined values
  const updateData: { name?: string; role?: Role; isEmailVerified?: boolean } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isEmailVerified !== undefined) updateData.isEmailVerified = data.isEmailVerified;

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
    },
  });
};


/**
 * Restrict a user account
 */
export const restrictUser = async (
  userId: string,
  adminId: string,
  reason: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (user.role === 'ADMIN') {
    throw AppError.forbidden('Cannot restrict admin users');
  }

  if (user.isRestricted) {
    throw AppError.badRequest('User is already restricted');
  }

  // Restrict user and revoke all refresh tokens
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isRestricted: true,
        restrictedAt: new Date(),
        restrictedBy: adminId,
        restrictionReason: reason,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { success: true, userId };
};

/**
 * Unrestrict a user account
 */
export const unrestrictUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (!user.isRestricted) {
    throw AppError.badRequest('User is not restricted');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isRestricted: false,
      restrictedAt: null,
      restrictedBy: null,
      restrictionReason: null,
    },
  });

  return { success: true, userId };
};

/**
 * Delete a user account
 */
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (user.role === 'ADMIN') {
    throw AppError.forbidden('Cannot delete admin users');
  }

  await prisma.user.delete({ where: { id: userId } });

  return { success: true, userId };
};

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

/**
 * Get paginated list of organizations with filters
 */
export const getOrganizations = async (
  filters: OrgFilters,
  pagination: PaginationParams
) => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.isVerified !== undefined) {
    where.isVerified = filters.isVerified;
  }
  if (filters.isRestricted !== undefined) {
    where.isRestricted = filters.isRestricted;
  }
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        kyc: {
          select: {
            status: true,
            submittedAt: true,
          },
        },
        members: {
          where: { orgRole: 'OWNER' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          take: 1,
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    organizations: orgs.map(org => ({
      id: org.id,
      name: org.name,
      type: org.type,
      isVerified: org.isVerified,
      isRestricted: org.isRestricted,
      restrictionReason: org.restrictionReason,
      kycStatus: org.kyc?.status || 'NOT_SUBMITTED',
      memberCount: org._count.members,
      owner: org.members[0]?.user || null,
      createdAt: org.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + orgs.length < total,
  };
};

/**
 * Get single organization by ID
 */
export const getOrganizationById = async (orgId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      kyc: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
              isRestricted: true,
            },
          },
        },
      },
    },
  });

  if (!org) {
    throw AppError.notFound('Organization not found');
  }

  return org;
};

/**
 * Restrict an organization
 */
export const restrictOrganization = async (
  orgId: string,
  adminId: string,
  reason: string
) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw AppError.notFound('Organization not found');
  }

  if (org.isRestricted) {
    throw AppError.badRequest('Organization is already restricted');
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      isRestricted: true,
      restrictedAt: new Date(),
      restrictedBy: adminId,
      restrictionReason: reason,
    },
  });

  return { success: true, orgId };
};

/**
 * Unrestrict an organization
 */
export const unrestrictOrganization = async (orgId: string) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw AppError.notFound('Organization not found');
  }

  if (!org.isRestricted) {
    throw AppError.badRequest('Organization is not restricted');
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      isRestricted: false,
      restrictedAt: null,
      restrictedBy: null,
      restrictionReason: null,
    },
  });

  return { success: true, orgId };
};

/**
 * Delete an organization (cascades to members, KYC)
 */
export const deleteOrganization = async (orgId: string) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw AppError.notFound('Organization not found');
  }

  await prisma.organization.delete({ where: { id: orgId } });

  return { success: true, orgId };
};

// ============================================================================
// KYC MANAGEMENT (Enhanced with pagination)
// ============================================================================

/**
 * Get paginated KYC submissions with filters
 */
export const getKycSubmissionsPaginated = async (
  filters: KycFilters,
  pagination: PaginationParams
) => {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.orgType || filters.search) {
    const orgFilter: Record<string, unknown> = {};
    if (filters.orgType) {
      orgFilter.type = filters.orgType;
    }
    if (filters.search) {
      orgFilter.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }
    where.organization = { is: orgFilter };
  }

  const [submissions, total] = await Promise.all([
    prisma.kycSubmission.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
            isRestricted: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.kycSubmission.count({ where }),
  ]);

  return {
    submissions: submissions.map(kyc => ({
      id: kyc.id,
      orgId: kyc.orgId,
      orgName: kyc.organization.name,
      orgType: kyc.organization.type,
      status: kyc.status,
      businessRegisteredName: kyc.businessRegisteredName,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      isOrgRestricted: kyc.organization.isRestricted,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + submissions.length < total,
  };
};

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async () => {
  const [
    totalUsers,
    totalOrgs,
    pendingKyc,
    restrictedUsers,
    restrictedOrgs,
    usersByRole,
    orgsByType,
    recentUsers,
    recentKyc,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { isRestricted: true } }),
    prisma.organization.count({ where: { isRestricted: true } }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    }),
    prisma.organization.groupBy({
      by: ['type'],
      _count: { type: true },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.kycSubmission.count({
      where: {
        submittedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    overview: {
      totalUsers,
      totalOrgs,
      pendingKyc,
      restrictedUsers,
      restrictedOrgs,
    },
    usersByRole: usersByRole.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<string, number>),
    orgsByType: orgsByType.reduce((acc, item) => {
      acc[item.type] = item._count.type;
      return acc;
    }, {} as Record<string, number>),
    recent: {
      newUsersThisWeek: recentUsers,
      kycSubmissionsThisWeek: recentKyc,
    },
  };
};
