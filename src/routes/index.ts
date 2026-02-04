import { Router } from 'express';
import authRoutes from './auth.routes';
import kycRoutes from './kyc.routes';
import adminRoutes from './admin.routes';
import listingRoutes from './listing.routes';
import hubRoutes from './hub.routes';
import claimRoutes from './claim.routes';
import profileRoutes from './profile.routes';

/**
 * Central Route Aggregator
 * Combines all route modules under /api prefix
 */

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Auth routes - /api/auth/*
router.use('/auth', authRoutes);

// Profile routes - /api/profile/* (user profile management)
router.use('/profile', profileRoutes);

// KYC routes - /api/kyc/* (organization KYC management)
router.use('/kyc', kycRoutes);

// Admin routes - /api/admin/* (admin management)
router.use('/admin', adminRoutes);

// Food Listing routes - /api/listings/* (supplier management)
router.use('/listings', listingRoutes);

// Donation Hub routes - /api/hub/* (public browsing)
router.use('/hub', hubRoutes);

// Claims routes - /api/claims/* (user claims)
router.use('/claims', claimRoutes);

export default router;
