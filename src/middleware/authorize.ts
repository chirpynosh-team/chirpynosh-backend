import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import type { Role } from '../generated/prisma/client';

/**
 * Authorization Middleware
 * Role-based and verification-based access control
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
 * Checks if their profile is verified
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

      // Check profile verification for NGO
      if (role === 'NGO_RECIPIENT') {
        const profile = await prisma.nGOProfile.findUnique({
          where: { userId },
          select: { isVerified: true },
        });

        if (!profile) {
          throw AppError.forbidden(
            'NGO profile not found. Please complete your profile.',
            'PROFILE_NOT_FOUND'
          );
        }

        if (!profile.isVerified) {
          throw AppError.forbidden(
            'Your NGO is pending verification. An admin will review your application.',
            'ORG_NOT_VERIFIED'
          );
        }
      }

      // Check profile verification for Supplier
      if (role === 'FOOD_SUPPLIER') {
        const profile = await prisma.supplierProfile.findUnique({
          where: { userId },
          select: { isVerified: true },
        });

        if (!profile) {
          throw AppError.forbidden(
            'Supplier profile not found. Please complete your profile.',
            'PROFILE_NOT_FOUND'
          );
        }

        if (!profile.isVerified) {
          throw AppError.forbidden(
            'Your business is pending verification. An admin will review your application.',
            'ORG_NOT_VERIFIED'
          );
        }
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
