import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Prisma Client Singleton
 * Prevents multiple instances in development with hot-reloading
 * 
 * Optimized for Neon's PgBouncer pooler:
 * - Small pool size (Neon pooler handles connection multiplexing)
 * - SSL enabled with rejectUnauthorized: false for Neon
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  
  // For Neon's PgBouncer pooler, use a small pool since the pooler handles multiplexing
  const pool = new pg.Pool({ 
    connectionString,
    max: 3, // Small pool - Neon pooler handles the real pooling
    connectionTimeoutMillis: 10000, // Allow time for cold start
    idleTimeoutMillis: 10000, // Release connections quickly
    // SSL is parsed from DATABASE_URL (sslmode=require)
  });

  pool.on('error', (err) => {
    console.error('❌ PG Pool error:', JSON.stringify({
      message: err.message,
      code: (err as unknown as Record<string, unknown>).code,
    }));
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({ adapter });
};

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Startup health check - verify Prisma client can connect
export const verifyDatabaseConnection = async () => {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT 1 as health');
    console.log('✅ Database connection verified:', JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', JSON.stringify({
      message: (error as Error).message,
      name: (error as Error).name,
      code: (error as unknown as Record<string, unknown>).code,
      meta: (error as unknown as Record<string, unknown>).meta,
    }));
    return false;
  }
};
