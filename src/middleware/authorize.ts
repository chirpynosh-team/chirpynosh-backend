import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import type { Role, OrgRole } from '../generated/prisma/client';

/**
 * Authorization Middleware
 * Role-based and organization-based access control
 */

/**
 * Require specific role(s)
 * Checks if the authenticated user has one of the required roles
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw AppError.forbidden(
          'You do not have permission to access this resource',
          'INSUFFICIENT_ROLE'
        );
      }

      next();
    }
  );
};

/**
 * Require organization verification
 * For NGO_RECIPIENT and FOOD_SUPPLIER roles
 * Checks if their organization is verified
 */
export const requireOrgVerified = () => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const { userId, role } = req.user;

      // SIMPLE_RECIPIENT and ADMIN don't need org verification
      if (role === 'SIMPLE_RECIPIENT' || role === 'ADMIN') {
        return next();
      }

      // Check if user has a verified organization
      const membership = await prisma.orgMember.findFirst({
        where: { userId },
        include: {
          org: {
            select: { isVerified: true },
          },
        },
      });

      if (!membership) {
        throw AppError.forbidden(
          'Organization not found. Please complete your profile.',
          'ORG_NOT_FOUND'
        );
      }

      if (!membership.org.isVerified) {
        throw AppError.forbidden(
          'Your organization is pending verification. An admin will review your application.',
          'ORG_NOT_VERIFIED'
        );
      }

      next();
    }
  );
};

/**
 * Require specific organization role
 * Checks if the user has one of the required roles in their organization
 */
export const requireOrgRole = (...allowedOrgRoles: OrgRole[]) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const membership = await prisma.orgMember.findFirst({
        where: { userId: req.user.userId },
      });

      if (!membership) {
        throw AppError.forbidden(
          'You are not a member of any organization',
          'NOT_ORG_MEMBER'
        );
      }

      if (!allowedOrgRoles.includes(membership.orgRole)) {
        throw AppError.forbidden(
          'You do not have the required organization role',
          'INSUFFICIENT_ORG_ROLE'
        );
      }

      next();
    }
  );
};

/**
 * Require verified role
 * Combined check: role + org verification
 * Use for actions that require fully verified NGO/Supplier
 */
export const requireVerifiedRole = (...allowedRoles: Role[]) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // First check role
      await new Promise<void>((resolve, reject) => {
        requireRole(...allowedRoles)(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Then check org verification
      await new Promise<void>((resolve, reject) => {
        requireOrgVerified()(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });

      next();
    }
  );
};

/**
 * Require admin role
 * Shorthand for requireRole('ADMIN')
 */
export const requireAdmin = () => requireRole('ADMIN');

/**
 * Require org owner or manager
 * Shorthand for org management access
 */
export const requireOrgManager = () => requireOrgRole('OWNER', 'MANAGER');

/**
 * Require org owner only
 * For critical org operations
 */
export const requireOrgOwner = () => requireOrgRole('OWNER');
