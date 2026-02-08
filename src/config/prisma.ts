import { PrismaClient } from '../generated/prisma/client';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Client Singleton for AWS RDS (Standard PostgreSQL)
 * 
 * Uses @prisma/adapter-pg with standard TCP connection to satisfy
 * runtime requirements while connecting to RDS.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  
  console.log('🔗 Initializing Prisma with DATABASE_URL:', connectionString ? `${connectionString.substring(0, 30)}...` : 'NOT SET');
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Create pg pool for standard TCP connection
  const pool = new Pool({ 
    connectionString,
    // Fix "self-signed certificate in certificate chain" error
    ssl: { rejectUnauthorized: false }
  });
  // Use adapter to satisfy runtime requirement (engineType="client")
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
    // Simple query to verify connection
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

