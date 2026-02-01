import { Router } from 'express';
import authRoutes from './auth.routes';

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

export default router;
