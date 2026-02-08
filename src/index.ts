import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { prisma, verifyDatabaseConnection } from './config/prisma';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import type { ApiErrorResponse } from './types/api.types';

// Import express.d.ts for type augmentation
import './types/express.d';

/**
 * Production-Ready Express Server
 * With graceful shutdown and comprehensive middleware stack
 */

const app = express();

console.log('📦 Server Version: v15 (Standard RDS)');

// Trust first proxy (ALB/CloudFront) for correct client IP in rate limiter
app.set('trust proxy', 1);

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet - Set security HTTP headers
app.use(helmet());

// CORS - Enable Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// =============================================================================
// PARSING MIDDLEWARE
// =============================================================================

// Cookie Parser
app.use(cookieParser(env.COOKIE_SECRET));

// JSON Body Parser
app.use(express.json({ limit: '10kb' }));

// URL Encoded Body Parser
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// =============================================================================
// RATE LIMITING
// =============================================================================

// Apply general rate limit to all API routes
app.use('/api', apiLimiter);

// =============================================================================
// ROUTES
// =============================================================================

// Mount all routes under /api
app.use('/api', routes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 Handler - Route not found
app.use((_req, res, _next) => {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
    },
  };
  res.status(404).json(response);
});

// Central Error Handler
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

const server = app.listen(env.PORT, async () => {
  // Verify database connection on startup
  await verifyDatabaseConnection();

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 Server running on port ${env.PORT}                  ║
║   📍 Environment: ${env.NODE_ENV.padEnd(36)}             ║
║   🔗 API: http://localhost:${env.PORT}/api               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const shutdown = async (signal: string) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('✅ HTTP server closed');

    try {
      // Disconnect from database
      await prisma.$disconnect();
      console.log('✅ Database connection closed');

      console.log('👋 Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

export default app;
