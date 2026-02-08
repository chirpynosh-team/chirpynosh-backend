import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Prisma Client Singleton
 * Prevents multiple instances in development with hot-reloading
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  
  const pool = new pg.Pool({ 
    connectionString,
    max: 10,
    // Connection acquisition timeout (fail fast instead of hanging)
    connectionTimeoutMillis: 10000,
    // Release idle connections after 30s
    idleTimeoutMillis: 30000,
    // TCP keepAlive prevents AWS NAT/firewalls from killing idle connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Don't let the pool exit when idle
    allowExitOnIdle: false,
  });

  // Log pool errors (dead connections, etc.)
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
      code: (error as Record<string, unknown>).code,
      meta: (error as Record<string, unknown>).meta,
    }));
    return false;
  }
};
